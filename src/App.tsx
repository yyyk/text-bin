import { use, useMemo, useState } from "react"
import { AtlasPreview, type PreviewControls } from "@/components/AtlasPreview"
import { FitBox } from "@/components/FitBox"
import { PanelSection } from "@/components/PanelSection"
import { StatsReadout } from "@/components/StatsReadout"
import { Toolbar } from "@/components/Toolbar"
import { Transport } from "@/components/Transport"
import { TriangleAlert } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppearanceSection } from "@/components/sections/AppearanceSection"
import { AtlasSection } from "@/components/sections/AtlasSection"
import { RandomSection } from "@/components/sections/RandomSection"
import { TextSection } from "@/components/sections/TextSection"
import { TimingSection } from "@/components/sections/TimingSection"
import { ViewSection } from "@/components/sections/ViewSection"
import { MotionSection } from "@/components/sections/MotionSection"
import { useDocument } from "@/hooks/useDocument"
import { useDocumentFile } from "@/hooks/useDocumentFile"
import { useNotice } from "@/hooks/useNotice"
import { useFonts } from "@/hooks/useFonts"
import { usePixelRatio } from "@/hooks/usePixelRatio"
import { usePreviewKeys } from "@/hooks/usePreviewKeys"
import { useSettled } from "@/hooks/useSettled"
import { builtInFonts, fontFromFile } from "@/lib/fonts"
import { defaultDoc, engineSettings } from "@/state/document"
import { defaultView, type PanelTab, type ViewOptions } from "@/state/view"

/**
 * The app: the atlas with the transport under it, and the panel beside it.
 * The state lives in hooks (src/hooks) and the panel's sections in
 * src/components/sections; this only connects them, as in type-shards.
 */
function App() {
  const { doc, setDoc, update, undo, redo, canUndo, canRedo } = useDocument()
  const fonts = useFonts(use(builtInFonts), doc.text.font)
  const [view, setView] = useState(defaultView)
  const [playing, setPlaying] = useState(true)
  const { notify, noticeFor } = useNotice()
  const file = useDocumentFile(doc, setDoc, fonts.isKnown, notify)
  // Only the engine's sections: a new colour mustn't start the engine over
  const { text, motion, timing, atlas, seed } = doc
  const { settings, easingError } = useMemo(
    () => engineSettings({ ...defaultDoc, text, motion, timing, atlas, seed }),
    [text, motion, timing, atlas, seed],
  )
  const [controls, setControls] = useState<PreviewControls | null>(null)
  // Drawn at the size it's shown: the pixel ratio times the fit, capped so a
  // large atlas fitted up stays a reasonable canvas. Settled first, as a new
  // scale replays the atlas up to the current frame.
  const pixelRatio = usePixelRatio()
  const [fitScale, setFitScale] = useState(1)
  const drawScale = useSettled(
    Math.min(
      MAX_CANVAS / Math.max(doc.atlas.width, doc.atlas.height),
      pixelRatio * (view.fit ? fitScale : 1),
    ),
    200,
  )
  const changeView = (patch: Partial<ViewOptions>) =>
    setView((v) => ({ ...v, ...patch }))
  const warnings = controls?.player.engine().warnings ?? []

  // An uploaded font joins the list and becomes the document's font
  const uploadFont = async (upload: File) => {
    try {
      const entry = await fontFromFile(
        upload,
        fonts.fonts.map((f) => f.name),
      )
      fonts.addFont(entry)
      update("text", { font: entry.id }, false)
    } catch (e) {
      notify("toolbar", `Couldn't read ${upload.name}: ${e}`, true)
    }
  }

  usePreviewKeys({
    togglePlaying: () => setPlaying((p) => !p),
    step: () => {
      setPlaying(false)
      controls?.step()
    },
    setFit: (fit) => changeView({ fit }),
  })

  return (
    <div className="flex h-screen">
      <main className="flex min-w-0 flex-1 flex-col bg-muted">
        <FitBox fit={view.fit} onScale={setFitScale}>
          <AtlasPreview
            settings={settings}
            font={fonts.font}
            scale={drawScale}
            appearance={doc.appearance}
            playing={playing}
            debug={view.debug}
            outlines={view.outlines}
            onControls={setControls}
          />
        </FitBox>
        <Transport
          controls={controls}
          playing={playing}
          onPlayingChange={setPlaying}
          fit={view.fit}
          onFitChange={(fit) => changeView({ fit })}
        />
      </main>
      {/* relative: the switches' hidden checkboxes are absolutely positioned;
          without it they'd be placed on the page and make it scroll */}
      <aside className="relative flex w-72 shrink-0 flex-col border-l">
        <Tabs
          value={view.tab}
          onValueChange={(tab) => changeView({ tab: tab as PanelTab })}
          className="min-h-0 flex-1 gap-0"
        >
          {/* The toolbar and the tabs stay put; only a tab's settings scroll */}
          <div className="space-y-3 border-b p-4 pb-3">
            <Toolbar
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onOpen={file.open}
              onSave={file.save}
              notice={noticeFor("toolbar")}
            />
            <TabsList className="w-full">
              <TabsTrigger value="text">
                Text {warnings.length > 0 && <TabWarning />}
              </TabsTrigger>
              <TabsTrigger value="motion">
                Motion {easingError && <TabWarning />}
              </TabsTrigger>
              <TabsTrigger value="atlas">Atlas</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="text" className={TAB}>
            <TextSection
              doc={doc}
              update={update}
              warnings={warnings}
              fonts={fonts.fonts}
              onUploadFont={uploadFont}
            />
            <AppearanceSection doc={doc} update={update} />
          </TabsContent>
          <TabsContent value="motion" className={TAB}>
            <MotionSection
              doc={doc}
              update={update}
              easingError={easingError}
            />
            <TimingSection doc={doc} update={update} />
          </TabsContent>
          <TabsContent value="atlas" className={TAB}>
            <AtlasSection doc={doc} update={update} />
            <RandomSection doc={doc} setDoc={setDoc} />
          </TabsContent>
          <TabsContent value="output" className={TAB}>
            <ViewSection view={view} onChange={changeView} />
            {view.debug && controls && (
              <PanelSection title="Stats">
                <StatsReadout player={controls.player} />
              </PanelSection>
            )}
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  )
}

/** The largest canvas side the preview draws, in device pixels */
const MAX_CANVAS = 8192

/** A tab's settings: scrolling on their own, under the tabs */
const TAB = "min-h-0 space-y-3 overflow-y-auto p-4"

/** A ⚠ on a tab whose settings have a problem (shown in its section too) */
function TabWarning() {
  return (
    <TriangleAlert
      aria-label="Has a problem"
      className="size-3.5 text-amber-700"
    />
  )
}

export default App
