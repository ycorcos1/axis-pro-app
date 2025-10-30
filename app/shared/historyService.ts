/**
 * History Service for PR #15 — Undo/Redo
 * @mem ref: pr15-undo-redo, timeline-history
 * Manages action history stack for timeline operations
 */

import type { Sequence } from "./timelineTypes.js";

/**
 * Action types that can be undone/redone
 */
export type ActionType =
  | "add-clip"
  | "move-clip"
  | "trim-clip"
  | "split-clip"
  | "delete-clip"
  | "update-track"
  | "batch";

/**
 * History action entry
 */
export interface HistoryAction {
  type: ActionType;
  timestamp: number;
  beforeSequence: Sequence;
  afterSequence: Sequence;
  description?: string;
}

/**
 * History manager configuration
 */
export interface HistoryConfig {
  maxStackSize?: number; // default: 50
  enableLogging?: boolean; // default: false
}

/**
 * History Service
 * Manages undo/redo stack for timeline operations
 */
export class HistoryService {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxStackSize: number;
  private enableLogging: boolean;
  private currentSequence: Sequence;

  constructor(initialSequence: Sequence, config?: HistoryConfig) {
    this.currentSequence = initialSequence;
    this.maxStackSize = config?.maxStackSize ?? 50;
    this.enableLogging = config?.enableLogging ?? false;
  }

  /**
   * Push a new action onto the history stack
   * This clears the redo stack
   */
  pushAction(
    type: ActionType,
    beforeSequence: Sequence,
    afterSequence: Sequence,
    description?: string
  ): void {
    const action: HistoryAction = {
      type,
      timestamp: Date.now(),
      beforeSequence: this.deepClone(beforeSequence),
      afterSequence: this.deepClone(afterSequence),
      description,
    };

    this.undoStack.push(action);
    this.redoStack = []; // Clear redo stack on new action
    this.currentSequence = this.deepClone(afterSequence);

    // Trim stack if exceeds max size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    if (this.enableLogging) {
      console.log(
        `[HistoryService] Action pushed: ${type} - ${description || ""}`,
        `Stack: ${this.undoStack.length} undo, ${this.redoStack.length} redo`
      );
    }
  }

  /**
   * Undo the last action
   * Returns the sequence to restore, or null if nothing to undo
   */
  undo(): Sequence | null {
    if (this.undoStack.length === 0) {
      if (this.enableLogging) {
        console.log("[HistoryService] Nothing to undo");
      }
      return null;
    }

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    this.currentSequence = this.deepClone(action.beforeSequence);

    if (this.enableLogging) {
      console.log(
        `[HistoryService] Undo: ${action.type} - ${action.description || ""}`,
        `Stack: ${this.undoStack.length} undo, ${this.redoStack.length} redo`
      );
    }

    return this.deepClone(action.beforeSequence);
  }

  /**
   * Redo the last undone action
   * Returns the sequence to restore, or null if nothing to redo
   */
  redo(): Sequence | null {
    if (this.redoStack.length === 0) {
      if (this.enableLogging) {
        console.log("[HistoryService] Nothing to redo");
      }
      return null;
    }

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    this.currentSequence = this.deepClone(action.afterSequence);

    if (this.enableLogging) {
      console.log(
        `[HistoryService] Redo: ${action.type} - ${action.description || ""}`,
        `Stack: ${this.undoStack.length} undo, ${this.redoStack.length} redo`
      );
    }

    return this.deepClone(action.afterSequence);
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get current sequence
   */
  getCurrentSequence(): Sequence {
    return this.deepClone(this.currentSequence);
  }

  /**
   * Update current sequence (used when history is bypassed)
   */
  setCurrentSequence(sequence: Sequence): void {
    this.currentSequence = this.deepClone(sequence);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    if (this.enableLogging) {
      console.log("[HistoryService] History cleared");
    }
  }

  /**
   * Get history statistics
   */
  getStats(): {
    undoCount: number;
    redoCount: number;
    totalActions: number;
    oldestAction?: number;
    newestAction?: number;
  } {
    const allActions = [...this.undoStack, ...this.redoStack];
    const timestamps = allActions.map((a) => a.timestamp);

    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      totalActions: allActions.length,
      oldestAction: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestAction: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  /**
   * Deep clone an object (sequence)
   * Uses JSON serialization for simplicity
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Create a new history service instance
 */
export function createHistoryService(
  initialSequence: Sequence,
  config?: HistoryConfig
): HistoryService {
  return new HistoryService(initialSequence, config);
}
