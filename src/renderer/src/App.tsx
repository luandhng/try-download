import { useEffect, useMemo, useState } from 'react'
import { CircleHelp, Download, Image as ImageIcon, Settings, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedGradient from '@/components/animated-gradient'
import { ColorSelector } from '@/components/color-selector'
import LightRays from '@/components/light-rays'
import { ShimmerText } from '@/components/shimmer-text'
import { Spinner } from '@/components/spinner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const qualities = [
  { value: 'best', label: 'Best' },
  { value: '2160', label: '2160p' },
  { value: '1440', label: '1440p' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' }
]

const videoFormats = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WEBM' }
]

const audioFormats = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' }
]

const audioQualities = [
  { value: 'best', label: 'Best' },
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '128', label: '128 kbps' }
]

const backgroundStyles = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'rays', label: 'Light rays' }
] as const

const accentColors = [
  '#B566FF',
  '#FF66B8',
  '#66B3FF',
  '#66FF85',
  '#FF9F21',
  '#FF5C5C',
  '#22D3EE',
  '#FACC15'
]

const supportedSites = [
  'YouTube',
  'YouTube Music',
  'Vimeo',
  'Dailymotion',
  'TikTok',
  'Instagram',
  'Facebook',
  'X (Twitter)',
  'Reddit',
  'Twitch',
  'SoundCloud',
  'Bandcamp',
  'Mixcloud',
  'Bilibili',
  'Niconico',
  'Rumble',
  'Odysee',
  'VK',
  'Loom',
  'Streamable',
  'Archive.org',
  'BBC iPlayer',
  'TED',
  'Direct media URLs'
]

const cookiesBrowsers: { value: CookiesBrowser; label: string }[] = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'edge', label: 'Edge' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'brave', label: 'Brave' },
  { value: 'chromium', label: 'Chromium' },
  { value: 'vivaldi', label: 'Vivaldi' },
  { value: 'opera', label: 'Opera' }
]

function timeAgo(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  localStorage.setItem('theme', mode)
}

const tabs = [
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' }
] as const

const themeTabs = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
] as const

const MotionCard = motion.create(Card)

function App(): React.JSX.Element {
  const [urlsText, setUrlsText] = useState('')
  const [mode, setMode] = useState<DownloadMode>('video')
  const [quality, setQuality] = useState('best')
  const [videoFormat, setVideoFormat] = useState('mp4')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [audioQuality, setAudioQuality] = useState('192')
  const [embedThumbnail, setEmbedThumbnail] = useState(false)
  const [queue, setQueue] = useState<QueueItemEvent[]>([])
  const [recent, setRecent] = useState<RecentDownload[]>([])
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sitesOpen, setSitesOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingUrls, setPendingUrls] = useState<string[]>([])
  const [qualityIssues, setQualityIssues] = useState<string[]>([])
  const [downloadDir, setDownloadDir] = useState('')
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [cookiesMode, setCookiesMode] = useState<CookiesMode>('none')
  const [cookiesBrowser, setCookiesBrowser] = useState<CookiesBrowser>('chrome')
  const [warning, setWarning] = useState<string | null>(null)
  const [background, setBackground] = useState(true)
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>('gradient')
  const [accentColor, setAccentColor] = useState('#B566FF')
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)

  const gradientConfig = useMemo(() => {
    const base = isDark ? '#000000' : '#FAFAFA'
    return {
      preset: 'custom',
      color1: accentColor,
      color2: base,
      color3: base,
      rotation: 0,
      proportion: 63,
      scale: 0.75,
      distortion: 5,
      swirl: 61,
      swirlIterations: 5,
      softness: 100,
      offset: -168,
      shape: 'Checks',
      shapeSize: 28,
      speed: 5
    } as const
  }, [accentColor, isDark])

  const raysColor = useMemo(() => ({ mode: 'single', color: accentColor }) as const, [accentColor])

  const raysAnimation = useMemo(() => ({ animate: true, speed: 3 }), [])

  const running = queue.some((item) => item.status === 'queued' || item.status === 'downloading')
  const activeItem = queue.find((item) => item.status === 'downloading')
  const urlCount = urlsText.split('\n').filter((line) => line.trim().length > 0).length

  useEffect(
    () =>
      window.api.onQueueItem((event) => {
        setQueue((prev) =>
          prev.map((item) => (item.id === event.id ? { ...item, ...event } : item))
        )
        if (event.status === 'done') {
          if (event.note) setWarning(event.note)
          void window.api.getRecentDownloads().then(setRecent)
        }
      }),
    []
  )

  useEffect(() => {
    void window.api.getRecentDownloads().then(setRecent)
  }, [])

  useEffect(() => {
    void window.api.getSettings().then((settings) => {
      setDownloadDir(settings.downloadDir)
      setTheme(settings.theme)
      setCookiesMode(settings.cookiesMode)
      setCookiesBrowser(settings.cookiesBrowser)
      applyTheme(settings.theme)
      setBackground(settings.background)
      setBackgroundStyle(settings.backgroundStyle)
      setAccentColor(settings.accentColor)
      setIsDark(document.documentElement.classList.contains('dark'))
    })
  }, [])

  const updateBackground = async (enabled: boolean): Promise<void> => {
    const settings = await window.api.updateSettings({ background: enabled })
    setBackground(settings.background)
  }

  const updateBackgroundStyle = async (style: BackgroundStyle): Promise<void> => {
    const settings = await window.api.updateSettings({ backgroundStyle: style })
    setBackgroundStyle(settings.backgroundStyle)
  }

  const updateAccentColor = async (color: string): Promise<void> => {
    const settings = await window.api.updateSettings({ accentColor: color })
    setAccentColor(settings.accentColor)
  }

  useEffect(() => {
    const onResize = (): void => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => {
      document.documentElement.classList.toggle('dark', media.matches)
      setIsDark(media.matches)
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])

  const changeTheme = async (mode: ThemeMode): Promise<void> => {
    const saved = await window.api.setTheme(mode)
    setTheme(saved)
    applyTheme(saved)
    setIsDark(document.documentElement.classList.contains('dark'))
  }

  const beginQueue = async (urls: string[]): Promise<void> => {
    const items = urls.map((url) => ({ id: crypto.randomUUID(), url }))
    setQueue(items.map((item) => ({ ...item, status: 'queued' as const })))
    setError(null)
    setWarning(null)
    try {
      await window.api.startQueue(items, {
        mode,
        quality,
        videoFormat,
        audioFormat,
        audioQuality,
        embedThumbnail
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const startQueue = async (): Promise<void> => {
    const urls = [
      ...new Set(
        urlsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      )
    ]
    if (urls.length === 0 || running || checking) return

    if (mode === 'video' && /^\d+$/.test(quality)) {
      setChecking(true)
      const issues: string[] = []
      try {
        for (const url of urls) {
          const info = await window.api.probeDownload(url)
          if (!info.direct && info.maxHeight && info.maxHeight < Number(quality)) {
            issues.push(`${info.title ?? url} (max ${info.maxHeight}p)`)
          }
        }
      } catch {
        // ignore probe failures and continue with the download
      } finally {
        setChecking(false)
      }
      if (issues.length > 0) {
        setPendingUrls(urls)
        setQualityIssues(issues)
        setConfirmOpen(true)
        return
      }
    }

    await beginQueue(urls)
  }

  const chooseFolder = async (): Promise<void> => {
    const dir = await window.api.chooseDownloadDir()
    if (dir) {
      setDownloadDir(dir)
    }
  }

  const updateCookiesMode = async (mode: CookiesMode): Promise<void> => {
    const settings = await window.api.updateSettings({ cookiesMode: mode })
    setCookiesMode(settings.cookiesMode)
  }

  const updateCookiesBrowser = async (browser: CookiesBrowser): Promise<void> => {
    const settings = await window.api.updateSettings({ cookiesBrowser: browser })
    setCookiesBrowser(settings.cookiesBrowser)
  }

  const removeRecent = async (entry: RecentDownload): Promise<void> => {
    setRecent(await window.api.removeRecentDownload(entry))
  }

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-4 overflow-hidden px-4">
      {background &&
        (backgroundStyle === 'rays' ? (
          <LightRays
            backgroundColor="transparent"
            raysColor={raysColor}
            animation={raysAnimation}
          />
        ) : (
          <AnimatedGradient config={gradientConfig} />
        ))}
      <div className="absolute top-4 left-4 font-heading text-base font-semibold tracking-tight">
        TryDownload
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings />
      </Button>
      <AnimatePresence initial={false}>
        {!running && (
          <motion.div
            key="composer"
            initial={{ y: -viewportHeight }}
            animate={{ y: 0 }}
            exit={{ y: -viewportHeight }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="flex w-full max-w-2xl flex-col gap-3"
          >
            <div className="rounded-2xl border border-foreground/10 bg-input/50 shadow-lg shadow-foreground/5 backdrop-blur-xl dark:bg-input/30">
              <Textarea
                placeholder="Paste one URL per line..."
                value={urlsText}
                onChange={(event) => setUrlsText(event.target.value)}
                disabled={running}
                className="max-h-40 min-h-20 resize-none rounded-none border-0 bg-transparent p-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-1">
                  <Tabs value={mode} onValueChange={(value) => setMode(value as DownloadMode)}>
                    <TabsList className="relative grid w-[168px] grid-cols-2 bg-input/50">
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ x: mode === 'video' ? '0%' : '100%' }}
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm dark:bg-input/30"
                      />
                      {tabs.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          disabled={running}
                          className={cn(
                            'relative z-10 bg-transparent data-active:bg-transparent data-[state=active]:bg-transparent',
                            'dark:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent',
                            mode === tab.value ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supported sites"
                    onClick={() => setSitesOpen(true)}
                  >
                    <CircleHelp />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {mode === 'video' ? (
                    <>
                      <Select value={videoFormat} onValueChange={setVideoFormat} disabled={running}>
                        <SelectTrigger className="w-[92px]">
                          <SelectValue placeholder="Format" />
                        </SelectTrigger>
                        <SelectContent>
                          {videoFormats.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={quality} onValueChange={setQuality} disabled={running}>
                        <SelectTrigger className="w-[92px]">
                          <SelectValue placeholder="Quality" />
                        </SelectTrigger>
                        <SelectContent>
                          {qualities.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Select value={audioFormat} onValueChange={setAudioFormat} disabled={running}>
                        <SelectTrigger className="w-[96px]">
                          <SelectValue placeholder="Format" />
                        </SelectTrigger>
                        <SelectContent>
                          {audioFormats.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={audioQuality}
                        onValueChange={setAudioQuality}
                        disabled={running}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue placeholder="Bitrate" />
                        </SelectTrigger>
                        <SelectContent>
                          {audioQualities.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant={embedThumbnail ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-9 gap-1.5 border-transparent',
                          !embedThumbnail &&
                            'bg-input/50 text-foreground hover:bg-input/50 dark:bg-input/50 dark:hover:bg-input/50'
                        )}
                        aria-pressed={embedThumbnail}
                        onClick={() => setEmbedThumbnail((value) => !value)}
                        disabled={running}
                      >
                        <ImageIcon className="size-4" />
                        Cover
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    aria-label={running ? 'Downloading' : checking ? 'Checking' : 'Download'}
                    onClick={() => void startQueue()}
                    disabled={running || checking || urlCount === 0}
                  >
                    {running || checking ? <Spinner size="sm" /> : <Download />}
                  </Button>
                </div>
              </div>
            </div>
            {!running && warning && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {running && (
          <motion.div
            key="downloading"
            initial={{ opacity: 0, filter: 'blur(12px)', y: 10 }}
            animate={{
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              transition: { duration: 0.4, ease: 'easeOut', delay: 0.2 }
            }}
            exit={{ opacity: 0, filter: 'blur(12px)', transition: { duration: 0.15 } }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <ShimmerText className="max-w-2xl truncate px-4 text-base">
              Downloading {activeItem?.name ?? activeItem?.url ?? ''}
            </ShimmerText>
          </motion.div>
        )}
      </AnimatePresence>
      {recent.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <motion.div layoutScroll className="flex justify-center-safe gap-3 overflow-x-auto p-3">
            <AnimatePresence initial={false} mode="popLayout">
              {recent.slice(0, 3).map((item) => (
                <MotionCard
                  key={`${item.path ?? item.name}-${item.timestamp}`}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', stiffness: 420, damping: 32 }
                  }}
                  exit={{
                    opacity: 0,
                    y: 8,
                    scale: 0.95,
                    transition: { duration: 0.22, ease: 'easeIn' }
                  }}
                  size="sm"
                  className="w-56 shrink-0 cursor-pointer rounded-2xl transition-colors data-[size=sm]:[--card-spacing:--spacing(2)] hover:bg-accent/50"
                  onClick={() => item.path && void window.api.openDownload(item.path)}
                >
                  <CardHeader className="px-3">
                    <CardTitle className="truncate text-sm">{item.name}</CardTitle>
                    <CardDescription className="text-xs">{timeAgo(item.timestamp)}</CardDescription>
                    <CardAction>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="-mt-1 -mr-1 text-muted-foreground"
                        aria-label={`Remove ${item.name} from recent downloads`}
                        onClick={(event) => {
                          event.stopPropagation()
                          void removeRecent(item)
                        }}
                      >
                        <X />
                      </Button>
                    </CardAction>
                  </CardHeader>
                </MotionCard>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="gap-8">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Save folder</span>
              <Button variant="outline" size="sm" onClick={() => void chooseFolder()}>
                Change
              </Button>
            </div>
            <p className="text-xs break-all text-muted-foreground">{downloadDir}</p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Cookies</span>
            <Select
              value={cookiesMode}
              onValueChange={(value) => void updateCookiesMode(value as CookiesMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Cookies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="browser">From browser</SelectItem>
              </SelectContent>
            </Select>
            {cookiesMode === 'browser' && (
              <Select
                value={cookiesBrowser}
                onValueChange={(value) => void updateCookiesBrowser(value as CookiesBrowser)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Browser" />
                </SelectTrigger>
                <SelectContent>
                  {cookiesBrowsers.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Sign in to the site in your browser to unlock members-only or higher-quality streams.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Theme</span>
            <Tabs value={theme} onValueChange={(value) => void changeTheme(value as ThemeMode)}>
              <TabsList className="relative grid w-full grid-cols-3">
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{
                    x: `${
                      Math.max(
                        0,
                        themeTabs.findIndex((tab) => tab.value === theme)
                      ) * 100
                    }%`
                  }}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                  className="absolute top-1 bottom-1 left-1 w-[calc(100%/3-8px/3)] rounded-full bg-background shadow-sm dark:bg-input/30"
                />
                {themeTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'relative z-10 bg-transparent data-active:bg-transparent data-[state=active]:bg-transparent',
                      'dark:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent',
                      theme === tab.value ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Animated Background</span>
              <Switch
                checked={background}
                onCheckedChange={(checked) => void updateBackground(checked)}
              />
            </div>
            {background && (
              <div className="flex items-center justify-between gap-3">
                <Select
                  value={backgroundStyle}
                  onValueChange={(value) => void updateBackgroundStyle(value as BackgroundStyle)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Background" />
                  </SelectTrigger>
                  <SelectContent>
                    {backgroundStyles.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ColorSelector
                  key={accentColor}
                  colors={accentColors}
                  size="default"
                  className="justify-end gap-2.5"
                  defaultValue={accentColor}
                  onColorSelect={(color) => void updateAccentColor(color)}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={sitesOpen} onOpenChange={setSitesOpen}>
        <DialogContent className="pt-4">
          <DialogHeader>
            <DialogTitle className="text-lg">Supported sites</DialogTitle>
            <DialogDescription>
              Downloads work with thousands of sites, including:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {supportedSites.map((site) => (
              <span key={site} className="text-muted-foreground">
                {site}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            DRM services like Netflix, Disney+, Spotify, and Apple Music are not supported.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lower quality than requested</DialogTitle>
            <DialogDescription>
              You asked for {quality}p, but these videos only go up to a lower quality:
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
            {qualityIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                void beginQueue(pendingUrls)
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
