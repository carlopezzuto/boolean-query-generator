#!/bin/bash
# Download comprehensive LinkedIn GEO data

QUERIES=(
  # Countries
  "United States" "United Kingdom" "Germany" "France" "Italy" "Spain"
  "Netherlands" "Belgium" "Switzerland" "Austria" "Poland" "Sweden"
  "Norway" "Denmark" "Finland" "Ireland" "Portugal" "Greece"
  "Czech Republic" "Romania" "Hungary" "Ukraine" "Russia" "Turkey"
  "Israel" "United Arab Emirates" "Saudi Arabia" "Qatar" "Egypt"
  "South Africa" "Nigeria" "Kenya" "Morocco" "India" "China" "Japan"
  "South Korea" "Singapore" "Malaysia" "Indonesia" "Thailand" "Vietnam"
  "Philippines" "Australia" "New Zealand" "Canada" "Mexico" "Brazil"
  "Argentina" "Chile" "Colombia" "Peru"
  # Major US Cities
  "New York" "Los Angeles" "Chicago" "Houston" "Phoenix" "Philadelphia"
  "San Antonio" "San Diego" "Dallas" "San Jose" "Austin" "Jacksonville"
  "San Francisco" "Seattle" "Denver" "Boston" "Atlanta" "Miami"
  "Washington DC" "Las Vegas" "Portland" "Detroit" "Minneapolis"
  # Major EU Cities
  "London" "Paris" "Berlin" "Madrid" "Rome" "Amsterdam" "Barcelona"
  "Munich" "Milan" "Vienna" "Prague" "Brussels" "Dublin" "Lisbon"
  "Stockholm" "Copenhagen" "Oslo" "Helsinki" "Warsaw" "Budapest"
  "Zurich" "Geneva" "Frankfurt" "Hamburg" "Manchester" "Birmingham"
  # Major Asian Cities
  "Tokyo" "Shanghai" "Beijing" "Hong Kong" "Singapore" "Seoul"
  "Mumbai" "Delhi" "Bangalore" "Chennai" "Hyderabad" "Pune"
  "Bangkok" "Jakarta" "Kuala Lumpur" "Manila" "Ho Chi Minh" "Hanoi"
  "Taipei" "Sydney" "Melbourne" "Auckland"
  # Major LATAM Cities
  "Sao Paulo" "Rio de Janeiro" "Mexico City" "Buenos Aires" "Bogota"
  "Lima" "Santiago" "Caracas" "Montevideo" "Quito"
  # Middle East
  "Dubai" "Abu Dhabi" "Tel Aviv" "Riyadh" "Doha" "Kuwait City"
  # Africa
  "Johannesburg" "Cape Town" "Lagos" "Nairobi" "Cairo" "Casablanca"
)

echo "Downloading ${#QUERIES[@]} locations..."
echo "["
first=true
for q in "${QUERIES[@]}"; do
  encoded=$(echo "$q" | sed 's/ /%20/g')
  result=$(curl -s "https://www.linkedin.com/jobs-guest/api/typeaheadHits?query=${encoded}&typeaheadType=GEO")
  if [ "$first" = true ]; then
    first=false
  else
    echo ","
  fi
  echo "$result" | tr -d '\n'
  sleep 0.25
done
echo "]"
