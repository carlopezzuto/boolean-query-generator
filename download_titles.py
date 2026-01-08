#!/usr/bin/env python3
"""Download LinkedIn Job Titles from guest API"""
import json
import urllib.request
import urllib.parse
import time

QUERIES = [
    # Engineering
    "Engineer", "Software Engineer", "Senior Software Engineer", "Staff Engineer",
    "Principal Engineer", "Lead Engineer", "Engineering Manager", "VP Engineering",
    "CTO", "Chief Technology Officer", "DevOps Engineer", "Site Reliability Engineer",
    "Platform Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
    "Data Engineer", "Machine Learning Engineer", "AI Engineer", "Cloud Engineer",
    "Infrastructure Engineer", "Security Engineer", "QA Engineer", "Test Engineer",
    "Embedded Engineer", "Firmware Engineer", "Hardware Engineer", "Systems Engineer",
    "Network Engineer", "Database Engineer", "Solutions Engineer", "Support Engineer",

    # Development
    "Developer", "Software Developer", "Web Developer", "Mobile Developer",
    "iOS Developer", "Android Developer", "React Developer", "Python Developer",
    "Java Developer", "JavaScript Developer", "Node.js Developer", ".NET Developer",
    "PHP Developer", "Ruby Developer", "Go Developer", "Rust Developer",
    "Game Developer", "Blockchain Developer", "Smart Contract Developer",

    # Data & Analytics
    "Data Scientist", "Data Analyst", "Business Analyst", "Business Intelligence",
    "Analytics Manager", "Data Architect", "Database Administrator", "DBA",
    "Machine Learning", "AI Researcher", "Research Scientist", "Statistician",

    # Product & Design
    "Product Manager", "Senior Product Manager", "Director of Product", "VP Product",
    "Chief Product Officer", "Product Owner", "Program Manager", "Project Manager",
    "Technical Program Manager", "Scrum Master", "Agile Coach",
    "Designer", "UX Designer", "UI Designer", "Product Designer", "Graphic Designer",
    "Visual Designer", "Interaction Designer", "Design Lead", "Creative Director",

    # Management & Leadership
    "Manager", "Senior Manager", "Director", "Senior Director", "VP", "Vice President",
    "SVP", "EVP", "C-Level", "CEO", "COO", "CFO", "CMO", "CHRO", "CIO",
    "General Manager", "Operations Manager", "Team Lead", "Tech Lead",
    "Department Head", "Division Head", "President", "Founder", "Co-Founder",

    # Sales & Marketing
    "Sales", "Account Executive", "Account Manager", "Sales Manager", "Sales Director",
    "VP Sales", "Business Development", "BDR", "SDR", "Sales Representative",
    "Marketing", "Marketing Manager", "Digital Marketing", "Content Marketing",
    "SEO Specialist", "SEM Specialist", "Growth Marketing", "Brand Manager",
    "Social Media Manager", "Marketing Director", "CMO",

    # HR & Recruiting
    "Recruiter", "Technical Recruiter", "Talent Acquisition", "HR Manager",
    "HR Business Partner", "HR Director", "CHRO", "People Operations",
    "Compensation Analyst", "Benefits Specialist", "Training Manager",

    # Finance & Accounting
    "Accountant", "Senior Accountant", "Controller", "Finance Manager",
    "Financial Analyst", "FP&A", "Investment Analyst", "Portfolio Manager",
    "Auditor", "Tax Manager", "Treasury", "CFO",

    # Consulting & Advisory
    "Consultant", "Senior Consultant", "Management Consultant", "Strategy Consultant",
    "IT Consultant", "Business Consultant", "Technical Consultant", "Advisory",
    "Partner", "Principal", "Associate", "Analyst",

    # Operations & Support
    "Operations", "Operations Manager", "Operations Director", "COO",
    "Customer Success", "Customer Support", "Technical Support", "Help Desk",
    "IT Support", "System Administrator", "IT Manager", "IT Director",

    # Legal & Compliance
    "Lawyer", "Attorney", "Legal Counsel", "General Counsel", "Paralegal",
    "Compliance Officer", "Risk Manager", "Regulatory Affairs",

    # Healthcare
    "Doctor", "Physician", "Nurse", "Registered Nurse", "Nurse Practitioner",
    "Medical Director", "Healthcare Administrator", "Clinical Research",

    # Other Common
    "Architect", "Solutions Architect", "Enterprise Architect", "Technical Architect",
    "Writer", "Technical Writer", "Content Writer", "Copywriter", "Editor",
    "Researcher", "Scientist", "Professor", "Teacher", "Instructor", "Trainer",
    "Executive Assistant", "Administrative Assistant", "Office Manager",
    "Coordinator", "Specialist", "Administrator", "Supervisor",
]

def fetch_titles(query):
    encoded = urllib.parse.quote(query)
    url = f"https://www.linkedin.com/jobs-guest/api/typeaheadHits?query={encoded}&typeaheadType=TITLE"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching {query}: {e}")
        return []

def main():
    all_results = []
    seen_ids = set()

    print(f"Downloading {len(QUERIES)} title queries...")
    for i, query in enumerate(QUERIES):
        results = fetch_titles(query)
        for item in results:
            if item.get("type") == "TITLE" and item.get("id") not in seen_ids:
                seen_ids.add(item["id"])
                all_results.append({
                    "id": item["id"],
                    "name": item["displayName"],
                    "type": "TITLE"
                })
        if (i + 1) % 20 == 0:
            print(f"  Processed {i + 1}/{len(QUERIES)}...")
        time.sleep(0.2)

    # Sort by name
    all_results.sort(key=lambda x: x["name"])

    # Save to file
    with open("linkedin_titles.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nDownloaded {len(all_results)} unique job titles")
    print("Saved to linkedin_titles.json")

if __name__ == "__main__":
    main()
