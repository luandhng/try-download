const APP_URL = 'http://127.0.0.1:38472'

async function flashBadge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color })
  await chrome.action.setBadgeText({ text })
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' })
  }, 2500)
}

chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url ?? ''
  if (!/^https?:\/\//i.test(url)) {
    await flashBadge('!', '#dc2626')
    return
  }
  try {
    const response = await fetch(`${APP_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await flashBadge('OK', '#16a34a')
  } catch {
    await flashBadge('X', '#dc2626')
  }
})
