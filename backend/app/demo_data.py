"""Demo persona (Maya) and the procedure catalog.

Every fee, coverage share, and plan value here is team-approved demo data
from CLAUDE.md section 9.
Do not add fees that are not sourced. Real fees (for example from FAIR Health)
must come from the team.
"""

from __future__ import annotations

from app.models import CatalogItem, Coverage, Plan, PlanOption, Procedure

# CDT codes for the three procedures we have sourced fees for.
FILLING_CDT = "D2391"  # Resin-based composite, one surface, posterior
ROOT_CANAL_CDT = "D3330"  # Endodontic therapy, molar
CROWN_CDT = "D2740"  # Crown, porcelain/ceramic

FILLING_FEE = 150
ROOT_CANAL_FEE = 1100
CROWN_FEE = 1300


def maya_procedures() -> list[Procedure]:
    """Maya's recommended care. All locked (can_wait=False) until the user confirms.

    Returns a fresh list each call so callers can modify it safely.
    Tooth numbers are left blank on purpose rather than made up.
    """
    return [
        Procedure(id="filling1", name="Filling", cdt_code=FILLING_CDT, category="basic",
                  billed_fee=FILLING_FEE, allowed_fee=FILLING_FEE),
        Procedure(id="filling2", name="Filling", cdt_code=FILLING_CDT, category="basic",
                  billed_fee=FILLING_FEE, allowed_fee=FILLING_FEE),
        Procedure(id="root_canal", name="Root canal", cdt_code=ROOT_CANAL_CDT, category="major",
                  billed_fee=ROOT_CANAL_FEE, allowed_fee=ROOT_CANAL_FEE),
        Procedure(id="crown1", name="Crown", cdt_code=CROWN_CDT, category="major",
                  billed_fee=CROWN_FEE, allowed_fee=CROWN_FEE, depends_on="root_canal"),
        Procedure(id="crown2", name="Crown", cdt_code=CROWN_CDT, category="major",
                  billed_fee=CROWN_FEE, allowed_fee=CROWN_FEE, depends_on="root_canal"),
    ]


def maya_plan() -> Plan:
    """Maya's plan, labeled "Demo plan" in the UI.

    Every value below is team-approved demo data from CLAUDE.md section 9.
    """
    return Plan(
        annual_max=1500,
        deductible=50,
        deductible_waived_for=["preventive"],
        # Demo values from CLAUDE.md section 9 (preventive 1.0, basic 0.8, major 0.5).
        coverage=Coverage(preventive=1.0, basic=0.8, major=0.5),
        # Demo value from CLAUDE.md section 9.
        reset_date="01-01",
        used_this_year=0,
        deductible_paid_this_year=0,
        in_network=True,
    )


CATALOG: list[CatalogItem] = [
    CatalogItem(cdt_code=FILLING_CDT, name="Filling", category="basic", default_fee=FILLING_FEE),
    CatalogItem(cdt_code=ROOT_CANAL_CDT, name="Root canal", category="major", default_fee=ROOT_CANAL_FEE),
    CatalogItem(cdt_code=CROWN_CDT, name="Crown", category="major", default_fee=CROWN_FEE),
]


# Employer plan options for "Compare plan options" (Find care). DEMO data, labeled
# "(demo)" in the UI, pending team approval. Names are generic: never a real insurer.
# Premiums live only on the options; maya_plan() and its section 9 values are unchanged.
CURRENT_PLAN_MONTHLY_PREMIUM = 40
BASIC_PPO_MONTHLY_PREMIUM = 25
PLUS_PPO_MONTHLY_PREMIUM = 60

PLAN_OPTIONS: list[PlanOption] = [
    PlanOption(
        id="current_plan",
        name="Current plan (demo)",
        monthly_premium=CURRENT_PLAN_MONTHLY_PREMIUM,
        plan=maya_plan(),
        source="demo",
    ),
    # Lower premium, smaller annual maximum, higher deductible.
    PlanOption(
        id="basic_ppo",
        name="Basic PPO (demo)",
        monthly_premium=BASIC_PPO_MONTHLY_PREMIUM,
        plan=maya_plan().model_copy(update={"annual_max": 1000, "deductible": 100}),
        source="demo",
    ),
    # Higher premium, bigger annual maximum, higher major coverage.
    PlanOption(
        id="plus_ppo",
        name="Plus PPO (demo)",
        monthly_premium=PLUS_PPO_MONTHLY_PREMIUM,
        plan=maya_plan().model_copy(
            update={"annual_max": 2500, "coverage": Coverage(preventive=1.0, basic=0.8, major=0.6)}
        ),
        source="demo",
    ),
]
