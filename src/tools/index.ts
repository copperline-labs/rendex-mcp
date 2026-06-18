export {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  ScreenshotInputSchema,
  handleScreenshot,
} from "./screenshot.js";
export type { ScreenshotInput } from "./screenshot.js";
export {
  EXTRACT_TOOL_NAME,
  EXTRACT_TOOL_DESCRIPTION,
  ExtractInputSchema,
  handleExtract,
} from "./extract.js";
export type { ExtractInput } from "./extract.js";

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
} from "./watch.js";
export type {
  WatchCreateInput,
  WatchTestInput,
  WatchListInput,
  WatchGetInput,
  WatchRunInput,
  WatchRunsInput,
  WatchDeleteInput,
} from "./watch.js";
