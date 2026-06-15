from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.app import services


TEST_JOBS = [
    {
        "id": "pk-lahore",
        "title": "Junior React Developer",
        "company": "Lahore Software House",
        "location": "Lahore, Pakistan",
        "type": "Full-time",
        "salary": "PKR 120k",
        "url": "https://example.com/lahore",
        "tags": ["React", "TypeScript"],
        "description": "Entry level React role.",
        "date": "2026-06-15",
        "source": "Jobz.pk",
        "role": "Frontend Developer",
    },
    {
        "id": "pk-islamabad",
        "title": "Python Backend Intern",
        "company": "Capital Tech",
        "location": "Islamabad, Pakistan",
        "type": "Internship",
        "salary": "PKR 60k",
        "url": "https://example.com/islamabad",
        "tags": ["Python", "FastAPI"],
        "description": "Backend internship using Python and FastAPI.",
        "date": "2026-06-14",
        "source": "Jobz.pk",
        "role": "Backend Developer",
    },
    {
        "id": "pk-karachi",
        "title": "Senior DevOps Engineer",
        "company": "Karachi Cloud",
        "location": "Hybrid - Karachi, Pakistan",
        "type": "Contract",
        "salary": "PKR 300k",
        "url": "https://example.com/karachi",
        "tags": ["Docker", "AWS"],
        "description": "Senior hybrid cloud infrastructure role.",
        "date": "2026-06-13",
        "source": "Jobz.pk",
        "role": "DevOps Engineer",
    },
]


class JobSearchTests(unittest.TestCase):
    def search(self, **filters: object) -> dict:
        page_size = int(filters.pop("page_size", 20))
        with patch.object(services, "get_live_jobs", return_value=TEST_JOBS):
            return services.search_jobs(
                ["React", "TypeScript", "Python", "FastAPI", "Docker", "AWS"],
                page_size=page_size,
                **filters,
            )

    def test_filters_each_supported_pakistan_city(self) -> None:
        for city in ("Lahore", "Islamabad", "Karachi"):
            with self.subTest(city=city):
                result = self.search(location=city)
                self.assertEqual(result["total"], 1)
                self.assertIn(city, result["items"][0]["location"])

    def test_combined_filters(self) -> None:
        result = self.search(
            location="Islamabad",
            type_filter="internship",
            work_mode="on-site",
            experience_level="entry",
            technologies=["Python"],
            min_salary=50_000,
        )
        self.assertEqual([job["id"] for job in result["items"]], ["pk-islamabad"])

    def test_hybrid_contract_and_salary_filters(self) -> None:
        result = self.search(
            location="Karachi",
            type_filter="contract",
            work_mode="hybrid",
            experience_level="senior",
            technologies=["Docker"],
            min_salary=250_000,
        )
        self.assertEqual([job["id"] for job in result["items"]], ["pk-karachi"])

    def test_pagination(self) -> None:
        first = self.search(page=1, page_size=2)
        second = self.search(page=2, page_size=2)
        self.assertEqual(len(first["items"]), 2)
        self.assertTrue(first["hasMore"])
        self.assertEqual(len(second["items"]), 1)
        self.assertFalse(second["hasMore"])


if __name__ == "__main__":
    unittest.main()
