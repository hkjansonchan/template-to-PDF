import puppeteer from "puppeteer"

export async function toPdf(html, path) {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.pdf({ path, format: "A4" })
  } finally {
    await browser.close()
  }
}
