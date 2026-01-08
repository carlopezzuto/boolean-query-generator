#!/bin/bash
# Download top companies

QUERIES=("Google" "Microsoft" "Apple" "Amazon" "Meta" "Netflix" "Tesla" "IBM" "Oracle" "Salesforce" "Adobe" "SAP" "Cisco" "Intel" "NVIDIA" "AMD" "Uber" "Airbnb" "Spotify" "Twitter" "LinkedIn" "PayPal" "Square" "Stripe" "Shopify" "Zoom" "Slack" "Atlassian" "GitHub" "GitLab" "MongoDB" "Snowflake" "Databricks" "Palantir" "Coinbase" "Robinhood" "JPMorgan" "Goldman Sachs" "Morgan Stanley" "Bank of America" "Citibank" "Wells Fargo" "HSBC" "Barclays" "Deutsche Bank" "UBS" "Credit Suisse" "Deloitte" "PwC" "EY" "KPMG" "McKinsey" "BCG" "Bain" "Accenture")

echo "["
first=true
for q in "${QUERIES[@]}"; do
  encoded=$(echo "$q" | sed 's/ /%20/g')
  result=$(curl -s "https://www.linkedin.com/jobs-guest/api/typeaheadHits?query=${encoded}&typeaheadType=COMPANY")
  if [ "$first" = true ]; then
    first=false
  else
    echo ","
  fi
  echo "$result" | tr -d '\n'
  sleep 0.3
done
echo "]"
