/** The panel's tabs */
export type PanelTab = "text" | "motion" | "atlas" | "output"

/** How the preview shows the document: not part of it (not saved) */
export interface ViewOptions {
  /** The panel's open tab */
  tab: PanelTab
  /** The atlas (and views) scaled to fit the window, or at 100% */
  fit: boolean
  /**
   * Debug mode: the camera views beside the atlas (each text drawn from
   * what the atlas has for it) and the engine's stats in the panel
   */
  debug: boolean
  /** In debug mode: each entry outlined, the ones just packed filled */
  outlines: boolean
}

export const defaultView: ViewOptions = {
  tab: "text",
  fit: true,
  debug: false,
  outlines: true,
}
