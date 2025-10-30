/**
 * Project IO Service with Auto-Save Support (PR #15)
 * @mem ref: pr9-dashboard, ipc-surface, pr15-undo-redo
 * Handles reading and writing project files to ~/AxisPro/projects/
 * Includes debounced auto-save functionality
 */

import fs from "fs/promises";
import path from "path";
import { homedir } from "os";
import type { Project, ProjectMetadata } from "../shared/types.js";

// Project root directory: ~/AxisPro/projects/
const PROJECTS_ROOT = path.join(homedir(), "AxisPro", "projects");

// Auto-save debounce timeout (3 seconds)
const AUTO_SAVE_DEBOUNCE_MS = 3000;

// Map to store debounce timers per project
const autoSaveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Ensure the projects directory exists
 */
export async function ensureProjectsDirectory(): Promise<void> {
  try {
    await fs.mkdir(PROJECTS_ROOT, { recursive: true });
    console.log("[ProjectIO] Projects directory ensured:", PROJECTS_ROOT);
  } catch (error) {
    console.error("[ProjectIO] Failed to create projects directory:", error);
    throw error;
  }
}

/**
 * Get the path to a specific project directory
 */
export function getProjectPath(projectId: string): string {
  return path.join(PROJECTS_ROOT, projectId);
}

/**
 * Get the path to a project's JSON file
 */
export function getProjectFilePath(projectId: string): string {
  return path.join(getProjectPath(projectId), "project.json");
}

/**
 * Get the path to a project's thumbnail
 */
export function getProjectThumbPath(projectId: string): string {
  return path.join(getProjectPath(projectId), "thumb.jpg");
}

/**
 * List all projects (returns metadata only)
 * Reads directories under ~/AxisPro/projects/ and parses project.json
 * Sorted by updatedAt descending (most recent first)
 */
export async function listProjects(): Promise<ProjectMetadata[]> {
  await ensureProjectsDirectory();

  try {
    const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
    const projectDirs = entries.filter((entry) => entry.isDirectory());

    const metadataPromises = projectDirs.map(async (dir) => {
      const projectId = dir.name;
      const projectFile = getProjectFilePath(projectId);

      try {
        const content = await fs.readFile(projectFile, "utf-8");
        const project: Project = JSON.parse(content);

        // Return only metadata for dashboard
        const metadata: ProjectMetadata = {
          id: project.id,
          title: project.title,
          updatedAt: project.updatedAt,
          stats: project.stats,
          previewThumbPath: project.previewThumbPath,
        };

        return metadata;
      } catch (error) {
        console.warn(`[ProjectIO] Failed to read project ${projectId}:`, error);
        return null;
      }
    });

    const allMetadata = await Promise.all(metadataPromises);
    const validMetadata = allMetadata.filter(
      (meta): meta is ProjectMetadata => meta !== null
    );

    // Sort by updatedAt descending
    validMetadata.sort((a, b) => b.updatedAt - a.updatedAt);

    console.log(`[ProjectIO] Found ${validMetadata.length} projects`);
    return validMetadata;
  } catch (error) {
    console.error("[ProjectIO] Failed to list projects:", error);
    return [];
  }
}

/**
 * Create a new empty project
 * Returns the created project
 */
export async function createProject(title: string): Promise<Project> {
  await ensureProjectsDirectory();

  const now = Date.now();
  const projectId = `project-${now}`;

  const project: Project = {
    id: projectId,
    title: title || "Untitled Project",
    createdAt: now,
    updatedAt: now,
    fps: 30, // default 30fps
    clips: {},
    segments: [],
    stats: {
      durationMs: 0,
      resolution: "",
      clipCount: 0,
    },
  };

  const projectPath = getProjectPath(projectId);
  await fs.mkdir(projectPath, { recursive: true });

  const projectFile = getProjectFilePath(projectId);
  await fs.writeFile(projectFile, JSON.stringify(project, null, 2), "utf-8");

  console.log(`[ProjectIO] Created project: ${projectId} at ${projectPath}`);
  return project;
}

/**
 * Load a full project by ID
 */
export async function loadProject(projectId: string): Promise<Project | null> {
  const projectFile = getProjectFilePath(projectId);

  try {
    const content = await fs.readFile(projectFile, "utf-8");
    const project: Project = JSON.parse(content);
    console.log(`[ProjectIO] Loaded project: ${projectId}`);
    return project;
  } catch (error) {
    console.error(`[ProjectIO] Failed to load project ${projectId}:`, error);
    return null;
  }
}

/**
 * Save (update) a project
 * Updates updatedAt timestamp automatically
 */
export async function saveProject(project: Project): Promise<void> {
  const projectPath = getProjectPath(project.id);
  await fs.mkdir(projectPath, { recursive: true });

  // Update timestamp
  project.updatedAt = Date.now();

  // Update stats
  project.stats = {
    durationMs:
      project.segments?.reduce((sum, seg) => {
        return sum + (seg.outMs - seg.inMs);
      }, 0) || 0,
    resolution: "",
    clipCount: project.clips ? Object.keys(project.clips).length : 0,
  };

  const projectFile = getProjectFilePath(project.id);
  await fs.writeFile(projectFile, JSON.stringify(project, null, 2), "utf-8");

  console.log(`[ProjectIO] Saved project: ${project.id}`);
}

/**
 * Rename a project (updates title)
 */
export async function renameProject(
  projectId: string,
  newTitle: string
): Promise<void> {
  const project = await loadProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  project.title = newTitle;
  await saveProject(project);

  console.log(`[ProjectIO] Renamed project ${projectId} to "${newTitle}"`);
}

/**
 * Duplicate a project
 * Copies directory and generates new ID
 */
export async function duplicateProject(projectId: string): Promise<Project> {
  const sourceProject = await loadProject(projectId);
  if (!sourceProject) {
    throw new Error(`Project ${projectId} not found`);
  }

  const now = Date.now();
  const newProjectId = `project-${now}`;

  const newProject: Project = {
    ...sourceProject,
    id: newProjectId,
    title: `${sourceProject.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  // Create new project directory
  const newProjectPath = getProjectPath(newProjectId);
  await fs.mkdir(newProjectPath, { recursive: true });

  // Save new project.json
  await saveProject(newProject);

  // Copy thumbnail if it exists
  const sourceThumb = getProjectThumbPath(projectId);
  const newThumb = getProjectThumbPath(newProjectId);

  try {
    await fs.copyFile(sourceThumb, newThumb);
    newProject.previewThumbPath = newThumb;
    await saveProject(newProject);
  } catch (error) {
    // Thumbnail doesn't exist, that's okay
    console.log(`[ProjectIO] No thumbnail to copy for ${projectId}`);
  }

  console.log(`[ProjectIO] Duplicated project ${projectId} to ${newProjectId}`);
  return newProject;
}

/**
 * Delete a project
 * Moves project directory to trash (on macOS) or deletes it
 */
export async function deleteProject(projectId: string): Promise<void> {
  const projectPath = getProjectPath(projectId);

  try {
    // On macOS, we could use 'trash' package or shell command
    // For now, just remove the directory
    await fs.rm(projectPath, { recursive: true, force: true });
    console.log(`[ProjectIO] Deleted project: ${projectId}`);
  } catch (error) {
    console.error(`[ProjectIO] Failed to delete project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Schedule an auto-save for a project (debounced)
 * Automatically saves after AUTO_SAVE_DEBOUNCE_MS milliseconds of no changes
 */
export function scheduleAutoSave(
  project: Project,
  callback?: () => void
): void {
  const projectId = project.id;

  // Clear existing timer if any
  if (autoSaveTimers.has(projectId)) {
    clearTimeout(autoSaveTimers.get(projectId)!);
  }

  // Schedule new save
  const timer = setTimeout(async () => {
    try {
      console.log(`[ProjectIO] Auto-saving project: ${projectId}`);
      await saveProject(project);
      console.log(`[ProjectIO] Auto-save completed: ${projectId}`);
      if (callback) callback();
    } catch (error) {
      console.error(`[ProjectIO] Auto-save failed for ${projectId}:`, error);
    } finally {
      autoSaveTimers.delete(projectId);
    }
  }, AUTO_SAVE_DEBOUNCE_MS);

  autoSaveTimers.set(projectId, timer);
  console.log(
    `[ProjectIO] Auto-save scheduled for ${projectId} in ${AUTO_SAVE_DEBOUNCE_MS}ms`
  );
}

/**
 * Cancel any pending auto-save for a project
 */
export function cancelAutoSave(projectId: string): void {
  if (autoSaveTimers.has(projectId)) {
    clearTimeout(autoSaveTimers.get(projectId)!);
    autoSaveTimers.delete(projectId);
    console.log(`[ProjectIO] Auto-save cancelled for ${projectId}`);
  }
}

/**
 * Check if a project has a pending auto-save
 */
export function hasPendingAutoSave(projectId: string): boolean {
  return autoSaveTimers.has(projectId);
}
