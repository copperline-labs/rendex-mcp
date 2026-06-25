export {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  ScreenshotInputSchema,
  handleScreenshot,
  RENDER_LINK_NAME,
  RENDER_LINK_DESCRIPTION,
  RenderLinkInputSchema,
  handleRenderLink,
} from "./screenshot.js";
export type { ScreenshotInput, RenderLinkInput } from "./screenshot.js";
export {
  EXTRACT_TOOL_NAME,
  EXTRACT_TOOL_DESCRIPTION,
  ExtractInputSchema,
  handleExtract,
} from "./extract.js";
export type { ExtractInput } from "./extract.js";
export {
  ARTIFACT_NAME,
  ARTIFACT_DESCRIPTION,
  ArtifactInputSchema,
  handleArtifact,
} from "./artifact.js";
export type { ArtifactInput } from "./artifact.js";
export {
  ACCOUNT_NAME,
  ACCOUNT_DESCRIPTION,
  AccountInputSchema,
  handleAccount,
} from "./account.js";
export type { AccountInput } from "./account.js";

// ─── Rendex Watch ──
export {
  WATCH_CREATE_NAME,
  WATCH_CREATE_DESCRIPTION,
  WatchCreateInputSchema,
  handleWatchCreate,
  WATCH_TEST_NAME,
  WATCH_TEST_DESCRIPTION,
  WatchTestInputSchema,
  handleWatchTest,
  WATCH_LIST_NAME,
  WATCH_LIST_DESCRIPTION,
  WatchListInputSchema,
  handleWatchList,
  WATCH_GET_NAME,
  WATCH_GET_DESCRIPTION,
  WatchGetInputSchema,
  handleWatchGet,
  WATCH_RUN_NAME,
  WATCH_RUN_DESCRIPTION,
  WatchRunInputSchema,
  handleWatchRun,
  WATCH_RUNS_NAME,
  WATCH_RUNS_DESCRIPTION,
  WatchRunsInputSchema,
  handleWatchRuns,
  WATCH_DELETE_NAME,
  WATCH_DELETE_DESCRIPTION,
  WatchDeleteInputSchema,
  handleWatchDelete,
  WATCH_UPDATE_NAME,
  WATCH_UPDATE_DESCRIPTION,
  WatchUpdateInputSchema,
  handleWatchUpdate,
} from "./watch.js";
export type {
  WatchCreateInput,
  WatchTestInput,
  WatchListInput,
  WatchGetInput,
  WatchRunInput,
  WatchRunsInput,
  WatchDeleteInput,
  WatchUpdateInput,
} from "./watch.js";
