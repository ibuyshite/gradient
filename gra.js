const { Builder, By, until, Capabilities } = require("selenium-webdriver")
const chrome = require("selenium-webdriver/chrome")
const url = require("url")
const fs = require("fs")
const crypto = require("crypto")
const request = require("request")
const path = require("path")
const FormData = require("form-data")
const proxy = require("selenium-webdriver/proxy")
const proxyChain = require("proxy-chain")
require("dotenv").config()

// Câu chào với màu xanh và chữ đậm
console.log('\x1b[32m\x1b[1m-> Viết Toàn Airdrop, Tools Free cho anh em!\x1b[0m');


// Cấu trúc tài khoản
const accounts = [
  // Format: {user: "email", password: "pass", proxy: "proxy_address"}
  // Ví dụ:
  // {user: "user1@example.com", password: "pass1", proxy: "127.0.0.1:8080"},
  // {user: "user2@example.com", password: "pass2", proxy: "127.0.0.1:8081"}
]

try {
  const accountsFile = fs.readFileSync('accounts.json', 'utf8')
  const accountsData = JSON.parse(accountsFile)
  accounts.push(...accountsData)
} catch (err) {
  console.log('-> Không tìm thấy tệp account.json, sử dụng env')
  if (process.env.APP_USER && process.env.APP_PASS) {
    accounts.push({
      user: process.env.APP_USER,
      password: process.env.APP_PASS,
      proxy: process.env.PROXY
    })
  }
}

const extensionId = "caacbgbklghmpodbdafajbgdnegacfmo"
const CRX_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=98.0.4758.102&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc&nacl_arch=x86-64`
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
const ALLOW_DEBUG = process.env.ALLOW_DEBUG === "True"
const EXTENSION_FILENAME = "app.crx"

// Kiểm tra xem có tài khoản nào không
if (accounts.length === 0) {
  console.error("Không có tài khoản nào được định cấu hình! Vui lòng thêm tài khoản vào account.json hoặc env")
  process.exit(1)
}

console.log(`-> Tìm thấy ${accounts.length} tài khoản`)

async function downloadExtension(extensionId) {
  const url = CRX_URL.replace(extensionId, extensionId)
  const headers = { "User-Agent": USER_AGENT }

  console.log("-> Downloading extension from:", url)

  // if file exists, return
  if (fs.existsSync(EXTENSION_FILENAME)) {
    console.log("-> Extension already downloaded! skip download...")
    return
  }

  return new Promise((resolve, reject) => {
    request({ url, headers, encoding: null }, (error, response, body) => {
      if (error) {
        console.error("Error downloading extension:", error)
        return reject(error)
      }
      fs.writeFileSync(EXTENSION_FILENAME, body)
      if (ALLOW_DEBUG) {
        const md5 = crypto.createHash("md5").update(body).digest("hex")
        console.log("-> Extension MD5: " + md5)
      }
      resolve()
    })
  })
}

async function takeScreenshot(driver, filename) {
  const data = await driver.takeScreenshot()
  fs.writeFileSync(filename, Buffer.from(data, "base64"))
}

async function generateErrorReport(driver) {
  await takeScreenshot(driver, "error.png")

  const logs = await driver.manage().logs().get("browser")
  fs.writeFileSync(
    "error.log",
    logs.map((log) => `${log.level.name}: ${log.message}`).join("\n")
  )
}

async function getDriverOptions(account) {
  const options = new chrome.Options()

  options.addArguments(`user-agent=${USER_AGENT}`)
  options.addArguments("--headless=new")
  options.addArguments("--ignore-certificate-errors")
  options.addArguments("--ignore-ssl-errors")
  options.addArguments("--no-sandbox")
  options.addArguments("--remote-allow-origins=*")
  options.addArguments("enable-automation")
  options.addArguments("--dns-prefetch-disable")
  options.addArguments("--disable-dev-shm-usage")
  options.addArguments("--disable-ipv6")
  options.addArguments("--aggressive-cache-discard")
  options.addArguments("--disable-cache")
  options.addArguments("--disable-application-cache")
  options.addArguments("--disable-offline-load-stale-cache")
  options.addArguments("--disk-cache-size=0")

  if (account.proxy) {
    console.log(`-> Thiết lập proxy cho ${account.user}:`, account.proxy)

    let proxyUrl = account.proxy
    if (!proxyUrl.includes("://")) {
      proxyUrl = `http://${proxyUrl}`
    }

    const newProxyUrl = await proxyChain.anonymizeProxy(proxyUrl)
    console.log("-> URL proxy mới:", newProxyUrl)

    options.setProxy(
      proxy.manual({
        http: newProxyUrl,
        https: newProxyUrl,
      })
    )
    const url = new URL(newProxyUrl)
    options.addArguments(`--proxy-server=socks5://${url.hostname}:${url.port}`)
  }

  return options
}

async function runAccount(account) {
  console.log(`-> Bắt đầu tài khoản ${account.user}...`)
  
  const options = await getDriverOptions(account)
  options.addExtensions(path.resolve(__dirname, EXTENSION_FILENAME))

  if (ALLOW_DEBUG) {
    options.addArguments("--enable-logging")
    options.addArguments("--v=1")
  }

  let driver
  try {
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build()

    console.log(`-> Trình duyệt đã bắt đầu cho ${account.user}`)

    console.log(`-> Đăng nhập ${account.user}...`)
    await driver.get("https://app.gradient.network/")

    const emailInput = By.css('[placeholder="Enter Email"]')
    const passwordInput = By.css('[type="password"]')
    const loginButton = By.css("button")

    await driver.wait(until.elementLocated(emailInput), 30000)
    await driver.wait(until.elementLocated(passwordInput), 30000)
    await driver.wait(until.elementLocated(loginButton), 30000)

    await driver.findElement(emailInput).sendKeys(account.user)
    await driver.findElement(passwordInput).sendKeys(account.password)
    await driver.findElement(loginButton).click()

    await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(), "Copy Referral Link")]')
      ),
      30000
    )

    console.log(`-> ${account.user} đã đăng nhập! Mở extension...`)

    await driver.get(`chrome-extension://${extensionId}/popup.html`)

    await driver.wait(
      until.elementLocated(By.xpath('//div[contains(text(), "Status")]')),
      30000
    )

    try {
      await driver.findElement(
        By.xpath(
          '//*[contains(text(), "Sorry, Gradient is not yet available in your region.")]'
        )
      )
      console.log(`-> ${account.user}: Gradient not available in region`)
      await driver.quit()
      return
    } catch (error) {
      // Region is available, continue
    }

    // Get status
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(), "Today\'s Taps")]')),
      30000
    )

    const supportStatus = await driver
      .findElement(By.css(".absolute.mt-3.right-0.z-10"))
      .getText()

    console.log(`-> ${account.user} Status:`, supportStatus)

    if (supportStatus.includes("Disconnected")) {
      console.log(`-> ${account.user}: Failed to connect!`)
      await driver.quit()
      return
    }

    setInterval(() => {
      driver.getTitle().then((title) => {
        console.log(`-> [${account.user}] Running...`, title)
        if (account.proxy) {
          console.log(`-> [${account.user}] Running with proxy ${account.proxy}...`)
        }
      })
    }, 10000)

  } catch (error) {
    console.error(`Error with account ${account.user}:`, error)
    if (driver) {
      await generateErrorReport(driver)
      await driver.quit()
    }
  }
}

async function main() {
  await downloadExtension(extensionId)
  
  const promises = accounts.map(account => runAccount(account))
  await Promise.all(promises)
}

main().catch(console.error)