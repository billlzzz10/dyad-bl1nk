import re
from playwright.sync_api import Page, expect, sync_playwright

def run(playwright):
    electron_app = playwright.electron.launch(executable_path="out/dyad-linux-x64/dyad")
    page = electron_app.first_window()

    # Navigate to settings
    page.click("text=Settings")

    # Verify Vercel provider
    expect(page.locator("text=Vercel")).to_be_visible()

    # Change language to Thai
    page.select_option("select", "th")
    expect(page.locator("text=การตั้งค่าทั่วไป")).to_be_visible()

    # Navigate to chat
    page.click("text=Chat")

    # Verify Clear Chat button
    expect(page.locator("text=Clear Chat")).to_be_visible()

    # Verify RAG option
    page.click("button[title='Attach files']")
    expect(page.locator("text=Upload Document for RAG")).to_be_visible()

    page.screenshot(path="jules-scratch/verification/verification.png")

    electron_app.close()

with sync_playwright() as playwright:
    run(playwright)