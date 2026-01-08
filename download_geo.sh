#!/bin/bash
# Download LinkedIn GEO locations

QUERIES=("United States" "United Kingdom" "Germany" "France" "Italy" "Spain" "Canada" "Australia" "India" "Brazil" "China" "Japan" "Netherlands" "Switzerland" "Singapore" "New York" "London" "Paris" "Berlin" "Milan" "Rome" "Toronto" "Sydney" "Mumbai" "Tokyo" "Amsterdam" "Dubai" "Hong Kong" "Los Angeles" "San Francisco" "Chicago" "Boston" "Seattle" "Austin" "Denver" "Atlanta" "Miami" "Dallas" "Phoenix" "Philadelphia")

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
  sleep 0.3
done
echo "]"
