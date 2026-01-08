#!/usr/bin/env python3
"""Download comprehensive LinkedIn Job Titles from guest API"""
import json
import urllib.request
import urllib.parse
import time
import string

# Alphabetical prefixes to catch more titles
ALPHA_QUERIES = list(string.ascii_lowercase)

QUERIES = [
    # A-Z single letters will be added from ALPHA_QUERIES

    # Common prefixes
    "Senior", "Junior", "Lead", "Head", "Chief", "Principal", "Staff",
    "Associate", "Assistant", "Executive", "Managing", "General",
    "Regional", "Global", "National", "VP", "Director", "Manager",

    # Engineering titles
    "Engineer", "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
    "Principal Software Engineer", "Lead Software Engineer", "Engineering Manager",
    "VP Engineering", "SVP Engineering", "CTO", "Chief Technology Officer",
    "DevOps", "SRE", "Site Reliability", "Platform Engineer", "Backend", "Frontend",
    "Full Stack", "Fullstack", "Data Engineer", "ML Engineer", "Machine Learning Engineer",
    "AI Engineer", "Cloud Engineer", "Infrastructure", "Security Engineer", "QA",
    "Test Engineer", "SDET", "Automation Engineer", "Performance Engineer",
    "Embedded", "Firmware", "Hardware Engineer", "Systems Engineer", "Network Engineer",
    "Database", "Solutions Engineer", "Field Engineer", "Support Engineer",
    "Release Engineer", "Build Engineer", "Integration Engineer",

    # Developer titles
    "Developer", "Software Developer", "Web Developer", "Mobile Developer",
    "iOS", "Android", "React", "Angular", "Vue", "Python Developer",
    "Java Developer", "JavaScript", "TypeScript", "Node", ".NET", "C#",
    "PHP Developer", "Ruby", "Rails", "Go Developer", "Golang", "Rust",
    "Scala", "Kotlin", "Swift Developer", "Game Developer", "Blockchain",
    "Smart Contract", "Solidity", "WordPress", "Drupal", "Magento",

    # Data titles
    "Data Scientist", "Data Analyst", "Business Analyst", "Business Intelligence",
    "BI Developer", "BI Analyst", "Analytics", "Data Architect", "DBA",
    "Database Administrator", "Machine Learning", "Deep Learning", "NLP",
    "Computer Vision", "AI Researcher", "Research Scientist", "Statistician",
    "Quantitative", "Quant", "Data Modeler", "ETL Developer",

    # Product & Design
    "Product Manager", "Product Owner", "Program Manager", "Project Manager",
    "Technical Program Manager", "TPM", "Scrum Master", "Agile",
    "Designer", "UX", "UI", "Product Designer", "Graphic Designer",
    "Visual Designer", "Interaction Designer", "Motion Designer",
    "Creative Director", "Art Director", "Design Lead", "UX Researcher",

    # Management
    "Manager", "Director", "VP", "Vice President", "SVP", "EVP",
    "CEO", "COO", "CFO", "CMO", "CIO", "CISO", "CRO", "CPO",
    "President", "Founder", "Co-Founder", "Owner", "Partner",
    "Team Lead", "Tech Lead", "Supervisor", "Coordinator",

    # Sales & BD
    "Sales", "Account Executive", "Account Manager", "Sales Manager",
    "Sales Director", "VP Sales", "Business Development", "BDR", "SDR",
    "Sales Representative", "Sales Engineer", "Pre-Sales", "Inside Sales",
    "Outside Sales", "Territory Manager", "Channel Manager", "Partner Manager",

    # Marketing
    "Marketing", "Marketing Manager", "Digital Marketing", "Content Marketing",
    "SEO", "SEM", "PPC", "Growth", "Growth Marketing", "Brand Manager",
    "Social Media", "Community Manager", "Content Strategist", "Copywriter",
    "Marketing Director", "VP Marketing", "Demand Generation", "Marketing Operations",

    # HR & People
    "Recruiter", "Technical Recruiter", "Talent Acquisition", "Sourcer",
    "HR Manager", "HR Business Partner", "HRBP", "HR Director", "CHRO",
    "People Operations", "People Partner", "Compensation", "Benefits",
    "Training", "Learning Development", "L&D", "Organizational Development",

    # Finance
    "Accountant", "Controller", "Finance Manager", "Financial Analyst",
    "FP&A", "Investment", "Portfolio Manager", "Auditor", "Tax",
    "Treasury", "CFO", "Finance Director", "Bookkeeper", "Payroll",

    # Operations
    "Operations", "Operations Manager", "COO", "Supply Chain",
    "Logistics", "Procurement", "Purchasing", "Inventory", "Warehouse",
    "Fulfillment", "Distribution", "Manufacturing", "Production",

    # Customer facing
    "Customer Success", "Customer Support", "Technical Support",
    "Customer Service", "Help Desk", "IT Support", "Desktop Support",
    "Implementation", "Onboarding", "Client Success", "Client Services",

    # IT & Admin
    "System Administrator", "Sysadmin", "IT Manager", "IT Director",
    "Network Administrator", "Security Analyst", "Information Security",
    "Cybersecurity", "Penetration Tester", "SOC Analyst",

    # Consulting
    "Consultant", "Senior Consultant", "Management Consultant",
    "Strategy Consultant", "IT Consultant", "SAP Consultant",
    "Salesforce", "Oracle Consultant", "Implementation Consultant",

    # Legal & Compliance
    "Lawyer", "Attorney", "Legal Counsel", "General Counsel",
    "Paralegal", "Compliance", "Risk", "Regulatory",

    # Healthcare
    "Doctor", "Physician", "Nurse", "RN", "Registered Nurse",
    "Nurse Practitioner", "NP", "Physician Assistant", "PA",
    "Medical Director", "Clinical", "Healthcare", "Pharmacist",

    # Other industries
    "Architect", "Solutions Architect", "Enterprise Architect",
    "Technical Architect", "Cloud Architect", "Security Architect",
    "Writer", "Technical Writer", "Content Writer", "Editor",
    "Researcher", "Scientist", "Professor", "Teacher", "Instructor",
    "Trainer", "Coach", "Mentor", "Advisor", "Specialist", "Expert",
]

def fetch_titles(query):
    encoded = urllib.parse.quote(query)
    url = f"https://www.linkedin.com/jobs-guest/api/typeaheadHits?query={encoded}&typeaheadType=TITLE"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        if "429" in str(e):
            print(f"  Rate limited on {query}, waiting...")
            time.sleep(2)
            return []
        elif "503" in str(e):
            time.sleep(0.5)
            return []
        else:
            print(f"Error fetching {query}: {e}")
            return []

def main():
    all_results = []
    seen_ids = set()

    # Combine all queries
    all_queries = ALPHA_QUERIES + QUERIES

    print(f"Downloading {len(all_queries)} title queries...")
    for i, query in enumerate(all_queries):
        results = fetch_titles(query)
        for item in results:
            if item.get("type") == "TITLE" and item.get("id") not in seen_ids:
                seen_ids.add(item["id"])
                all_results.append({
                    "id": item["id"],
                    "name": item["displayName"],
                    "type": "TITLE"
                })
        if (i + 1) % 25 == 0:
            print(f"  Processed {i + 1}/{len(all_queries)} - Found {len(all_results)} titles...")
        time.sleep(0.25)

    # Sort by name
    all_results.sort(key=lambda x: x["name"])

    # Save to file
    with open("linkedin_titles.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nDownloaded {len(all_results)} unique job titles")
    print("Saved to linkedin_titles.json")

if __name__ == "__main__":
    main()
