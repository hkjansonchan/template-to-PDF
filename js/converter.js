import puppeteer from "puppeteer"

export async function toPdf(html, path) {
  let browser
  try {
    browser = await puppeteer.launch({ headless: true })
  } catch {
    browser = await puppeteer.launch({ channel: "chrome", headless: true })
  }
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.pdf({ path, format: "A4" })
  } finally {
    await browser.close()
  }
}
