#!/usr/bin/env python3
"""CI entrypoint for the full browser acceptance suite.

The core browser-smoke suite predates the required Male/Female onboarding choice.
Keep the full suite intact, but make its automated resident behave like a current
player by choosing the real custom radio controls before continuing.
"""
import asyncio
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('abujalife_browser_smoke', HERE / 'browser-smoke.py')
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)


async def complete_current_resident_wizard(page, display_name, hair):
    await smoke.expect(page.locator('#onboarding-form')).to_be_visible()
    for _ in range(10):
        form = page.locator('#onboarding-form')
        name_control = form.locator('[name="displayName"]:visible')
        if await name_control.count():
            await name_control.fill(display_name)

        presentation = form.locator('[name="presentation"][value="feminine"]')
        if await presentation.count():
            await presentation.check(force=True)
            assert await presentation.is_checked(), 'Required gender choice did not commit'

        hair_choice = form.locator(f'[name="hair"][value="{hair}"]')
        if await hair_choice.count():
            await hair_choice.check(force=True)
        else:
            hair_control = form.locator('select[name="hair"]:visible')
            if await hair_control.count():
                await hair_control.select_option(hair)

        goal_control = form.locator('[name="lifeGoal"][value="career"]')
        if await goal_control.count():
            await goal_control.check(force=True)

        begin = page.locator('#begin-life:visible')
        if await begin.count():
            await begin.click()
            break

        next_button = page.locator('[data-onboarding-next]:visible')
        assert await next_button.count(), 'Wizard has no visible next or begin control'
        await next_button.click()

    await smoke.expect(page.locator('#onboarding-form')).to_have_count(0)
    await smoke.expect(page.locator('.game-nav')).to_be_visible()
    profile = (await smoke.bootstrap(page))['profile']
    assert profile['onboardingComplete'] is True
    assert profile['displayName'] == display_name and profile['appearance']['hair'] == hair
    assert profile['appearance']['presentation'] == 'feminine'
    assert profile['lifeGoal'] == 'career'


smoke.complete_resident_wizard = complete_current_resident_wizard

if __name__ == '__main__':
    asyncio.run(smoke.main())
