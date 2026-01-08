#!/usr/bin/env python3
"""Download LinkedIn GEO data from guest API"""
import json
import urllib.request
import urllib.parse
import time

QUERIES = [
    # Countries
    "United States", "United Kingdom", "Germany", "France", "Italy", "Spain",
    "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Sweden",
    "Norway", "Denmark", "Finland", "Ireland", "Portugal", "Greece",
    "Czech Republic", "Romania", "Hungary", "Ukraine", "Russia", "Turkey",
    "Israel", "United Arab Emirates", "Saudi Arabia", "Qatar", "Egypt",
    "South Africa", "Nigeria", "Kenya", "Morocco", "India", "China", "Japan",
    "South Korea", "Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam",
    "Philippines", "Australia", "New Zealand", "Canada", "Mexico", "Brazil",
    "Argentina", "Chile", "Colombia", "Peru", "Venezuela", "Ecuador",
    # US States
    "California", "Texas", "Florida", "New York State", "Pennsylvania",
    "Illinois", "Ohio", "Georgia", "North Carolina", "Michigan", "New Jersey",
    "Virginia", "Washington State", "Arizona", "Massachusetts", "Tennessee",
    "Colorado", "Maryland", "Minnesota", "Wisconsin", "Oregon", "Connecticut",
    # Major US Cities
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "San Francisco", "Seattle", "Denver", "Boston", "Atlanta", "Miami",
    "Washington DC", "Las Vegas", "Portland", "Detroit", "Minneapolis",
    "Charlotte", "Nashville", "Baltimore", "Salt Lake City", "Pittsburgh",
    "Cincinnati", "Kansas City", "Cleveland", "Indianapolis", "Columbus Ohio",
    "Raleigh", "Tampa", "St Louis", "Orlando", "Sacramento", "San Bernardino",
    # Major EU Cities
    "London", "Paris", "Berlin", "Madrid", "Rome", "Amsterdam", "Barcelona",
    "Munich", "Milan", "Vienna", "Prague", "Brussels", "Dublin", "Lisbon",
    "Stockholm", "Copenhagen", "Oslo", "Helsinki", "Warsaw", "Budapest",
    "Zurich", "Geneva", "Frankfurt", "Hamburg", "Manchester", "Birmingham",
    "Leeds", "Glasgow", "Edinburgh", "Lyon", "Marseille", "Toulouse",
    "Cologne", "Stuttgart", "Dusseldorf", "Athens", "Bucharest", "Sofia",
    # Major Asian Cities
    "Tokyo", "Shanghai", "Beijing", "Hong Kong", "Singapore", "Seoul",
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata",
    "Bangkok", "Jakarta", "Kuala Lumpur", "Manila", "Ho Chi Minh", "Hanoi",
    "Taipei", "Sydney", "Melbourne", "Auckland", "Brisbane", "Perth",
    "Osaka", "Nagoya", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou",
    # LATAM
    "Sao Paulo", "Rio de Janeiro", "Mexico City", "Buenos Aires", "Bogota",
    "Lima", "Santiago", "Caracas", "Montevideo", "Quito", "Guadalajara",
    "Monterrey", "Medellin", "Cali", "Brasilia", "Salvador", "Fortaleza",
    # Middle East
    "Dubai", "Abu Dhabi", "Tel Aviv", "Riyadh", "Doha", "Kuwait City",
    "Muscat", "Amman", "Beirut", "Jerusalem", "Haifa",
    # Africa
    "Johannesburg", "Cape Town", "Lagos", "Nairobi", "Cairo", "Casablanca",
    "Accra", "Addis Ababa", "Dar es Salaam", "Tunis", "Algiers",
    # Canada
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton",
    "Winnipeg", "Quebec City", "Halifax", "Victoria",
]

def fetch_geo(query):
    encoded = urllib.parse.quote(query)
    url = f"https://www.linkedin.com/jobs-guest/api/typeaheadHits?query={encoded}&typeaheadType=GEO"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching {query}: {e}")
        return []

def main():
    all_results = []
    seen_ids = set()

    print(f"Downloading {len(QUERIES)} locations...")
    for i, query in enumerate(QUERIES):
        results = fetch_geo(query)
        for item in results:
            if item.get("type") == "GEO" and item.get("id") not in seen_ids:
                seen_ids.add(item["id"])
                all_results.append({
                    "id": item["id"],
                    "name": item["displayName"],
                    "type": "GEO"
                })
        if (i + 1) % 20 == 0:
            print(f"  Processed {i + 1}/{len(QUERIES)}...")
        time.sleep(0.2)

    # Sort by name
    all_results.sort(key=lambda x: x["name"])

    # Save to file
    with open("linkedin_geo_complete.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nDownloaded {len(all_results)} unique locations")
    print("Saved to linkedin_geo_complete.json")

if __name__ == "__main__":
    main()
