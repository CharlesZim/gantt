// Shared geometry constants used by both the on-screen renderer and the
// export pipeline, so the two produce identical layouts. Pure values.

export const ROW_HEIGHT = 46;
export const BAR_HEIGHT = 28;
export const TASK_LIST_WIDTH = 280;
export const AXIS_TOP_HEIGHT = 26; // months / years band
export const AXIS_BOTTOM_HEIGHT = 26; // days / weeks / months band
export const AXIS_HEIGHT = AXIS_TOP_HEIGHT + AXIS_BOTTOM_HEIGHT;
export const PAD_DAYS = 2;
