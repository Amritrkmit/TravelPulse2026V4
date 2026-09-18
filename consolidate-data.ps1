Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$surveyPath = Join-Path $root '03.09.2026 -CleanDataFile W2 - Z230012 - SAT Travel Sentiment - Travel Pulse.xlsx'
$mappingPath = Join-Path $root 'Mapping_country_region_classified _03.09.2026.xlsx'
$brandwatchPath = Join-Path $root 'Brandwatch_SourceMarkets_Data.xlsx'
$outputPath = Join-Path $root 'data.json'
$socialOutputPath = Join-Path $root 'social-data.json'

function Read-XlsxRows([string]$path) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
  try {
    $strings = @()
    $shared = $zip.GetEntry('xl/sharedStrings.xml')
    if ($shared) {
      $reader = [IO.StreamReader]::new($shared.Open())
      try { $xml = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
      $strings = @($xml.SelectNodes("//*[local-name()='si']") | ForEach-Object { $_.InnerText })
    }

    $sheet = $zip.GetEntry('xl/worksheets/sheet1.xml')
    $reader = [IO.StreamReader]::new($sheet.Open())
    try { $xml = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    $rows = @($xml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']"))
    $result = [Collections.Generic.List[object]]::new()
    foreach ($row in $rows) {
      $values = @{}
      foreach ($cell in @($row.SelectNodes("*[local-name()='c']"))) {
        $ref = $cell.GetAttribute('r')
        $column = ($ref -replace '\d','')
        $valueNode = $cell.SelectSingleNode("*[local-name()='v']")
        $value = if ($valueNode) { $valueNode.InnerText } else { '' }
        if ($cell.GetAttribute('t') -eq 's' -and $value -ne '') { $value = $strings[[int]$value] }
        if ($cell.GetAttribute('t') -eq 'inlineStr') {
          $textNode = $cell.SelectSingleNode("*[local-name()='is']")
          $value = if ($textNode) { $textNode.InnerText } else { '' }
        }
        $values[$column] = $value
      }
      $result.Add($values)
    }
    return $result
  } finally { $zip.Dispose() }
}

function ColumnName([int]$number) {
  $name = ''
  while ($number -gt 0) {
    $number--
    $name = [char](65 + ($number % 26)) + $name
    $number = [math]::Floor($number / 26)
  }
  return $name
}

function Convert-RowsToObjects($rows) {
  if (-not $rows.Count) { return @() }
  $headers = @{}
  foreach ($key in $rows[0].Keys) { $headers[$key] = [string]$rows[0][$key] }
  $objects = [Collections.Generic.List[object]]::new()
  foreach ($row in ($rows | Select-Object -Skip 1)) {
    $item = [ordered]@{}
    foreach ($key in $headers.Keys) {
      $header = $headers[$key]
      if ([string]::IsNullOrWhiteSpace($header)) { continue }
      $item[$header] = [string]($row[$key])
    }
    if ($item.Count) { $objects.Add([pscustomobject]$item) }
  }
  return $objects
}

function Clean-Text([object]$value) {
  if ($null -eq $value) { return '' }
  return ([regex]::Replace([string]$value, '<[^>]*>', '') -replace '\s+', ' ').Trim()
}

$aliases = @{
  'USA' = 'United States of America'; 'United States' = 'United States of America'
  'UK' = 'United Kingdom'; 'UAE' = 'United Arab Emirates'
  'Russia' = 'Russian Federation'; 'South Korea' = 'Korea, Republic of (South Korea)'
}
$marketRegions = @{
  'Australia'='Oceania'; 'Bahrain'='ME'; 'Brazil'='LATAM'; 'Canada'='North America'
  'China'='Asia'; 'Egypt'='Africa'; 'France'='Europe'; 'Germany'='Europe'; 'India'='Asia'
  'Indonesia'='Asia'; 'Ireland'='Europe'; 'Italy'='Europe'; 'Japan'='Asia'; 'Jordan'='ME'
  'Kenya'='Africa'; 'Korea, Republic of (South Korea)'='Asia'; 'Malaysia'='Asia'
  'Netherlands'='Europe'; 'Nigeria'='Africa'; 'Qatar'='ME'; 'Russian Federation'='Europe'
  'Saudi Arabia'='ME'; 'Singapore'='Asia'; 'South Africa'='Africa'; 'Spain'='Europe'
  'Switzerland'='Europe'; 'Thailand'='Asia'; 'Turkey'='ME'; 'United Arab Emirates'='ME'
  'United Kingdom'='Europe'; 'United States of America'='North America'
}

$survey = Get-Content -Raw -Path $outputPath | ConvertFrom-Json
$mappingRows = Convert-RowsToObjects (Read-XlsxRows $mappingPath)
$regionByCountry = @{}
foreach ($row in $mappingRows) {
  $country = Clean-Text $row.Country
  $region = Clean-Text $row.Region
  if ($country -and $region) { $regionByCountry[$country] = $region }
}

$survey.records = @($survey.records | ForEach-Object {
  $market = Clean-Text $_.Market
  if ($aliases.ContainsKey($market)) { $market = $aliases[$market] }
  $brandSource = if ($null -ne $_.hotelBrand -and (Clean-Text $_.hotelBrand)) { $_.hotelBrand } else { $_.Q21 }
  $brand = Clean-Text $brandSource
  $_.Market = $market
  $_.Region = if (Clean-Text $_.Region) { Clean-Text $_.Region } elseif ($regionByCountry.ContainsKey($market)) { $regionByCountry[$market] } else { '' }
  $_.hotelBrand = $brand
  $_.Q21 = Clean-Text $_.Q21
  $_
})

$brandwatchRows = Convert-RowsToObjects (Read-XlsxRows $brandwatchPath)
$socialRecords = @($brandwatchRows | ForEach-Object {
  $market = Clean-Text $_.'Source Market'
  $destination = Clean-Text $_.'Destination Market'
  if ($aliases.ContainsKey($market)) { $market = $aliases[$market] }
  if ($aliases.ContainsKey($destination)) { $destination = $aliases[$destination] }
  [ordered]@{
    sourceType = 'Brandwatch'
    sourceMarket = $market
    region = if ($regionByCountry.ContainsKey($market)) { $regionByCountry[$market] } elseif ($marketRegions.ContainsKey($market)) { $marketRegions[$market] } else { '' }
    wave = Clean-Text $_.Wave
    wavePeriod = Clean-Text $_.'Wave Period'
    snippet = Clean-Text $_.Snippet_lower
    sentiment = Clean-Text $_.Sentiments
    destination = $destination
    themes = @(Clean-Text $_.'Key Themes')
    url = Clean-Text $_.URL
  }
})

$waveSummary = @($socialRecords | Group-Object -Property { $_.wave } | ForEach-Object { [ordered]@{ wave = $_.Name; records = $_.Count } })
$sentimentSummary = @($socialRecords | Group-Object -Property { $_.sentiment } | ForEach-Object { [ordered]@{ sentiment = $_.Name; records = $_.Count } })
$survey.meta = [ordered]@{
  source = 'Consolidated survey, country-region mapping, and Brandwatch data'
  totalRespondents = @($survey.records).Count
  socialRecords = $socialRecords.Count
  questionCount = $survey.meta.questionCount
  wave = 'Wave 2 survey; Brandwatch waves preserved'
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$survey | Add-Member -NotePropertyName socialRecords -NotePropertyValue $socialRecords -Force
$survey | Add-Member -NotePropertyName mappings -NotePropertyValue ([ordered]@{ countryRegion = $regionByCountry; aliases = $aliases }) -Force
$survey | Add-Member -NotePropertyName socialSummary -NotePropertyValue ([ordered]@{ waves = $waveSummary; sentiments = $sentimentSummary }) -Force
$socialRecords | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $socialOutputPath -Encoding UTF8
$survey.PSObject.Properties.Remove('socialRecords')
$survey | ConvertTo-Json -Depth 20 -Compress | Set-Content -Path $outputPath -Encoding UTF8
Write-Output "Consolidated $(@($survey.records).Count) survey records into $outputPath and $($socialRecords.Count) social records into $socialOutputPath"