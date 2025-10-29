import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User,
  Project,
  RunSnapshot,
  Toast,
  Modal,
  Settings,
  Scenario,
} from '@/types';

// User Store
interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      setTheme: (theme) =>
        set((state) => ({
          user: state.user ? { ...state.user, theme } : null,
        })),
      logout: () => set({ user: null }),
    }),
    {
      name: 'user-storage',
    }
  )
);

// Project Store
interface ProjectState {
  activeProjectId: string | null;
  projects: Project[];
  currentProject: Project | null;
  setActiveProject: (id: string) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  updateSettings: (settings: Settings) => void;
  addScenario: (scenario: Scenario) => void;
  deleteScenario: (scenarioId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      projects: [],
      currentProject: null,

      setActiveProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        set({ activeProjectId: id, currentProject: project || null });
      },

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          currentProject: project,
        })),

      updateProject: (id, updates) =>
        set((state) => {
          const projects = state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          );
          const currentProject =
            state.activeProjectId === id
              ? projects.find((p) => p.id === id) || null
              : state.currentProject;
          return { projects, currentProject };
        }),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId:
            state.activeProjectId === id ? null : state.activeProjectId,
          currentProject:
            state.activeProjectId === id ? null : state.currentProject,
        })),

      updateSettings: (settings) => {
        const { activeProjectId, currentProject } = get();
        if (activeProjectId && currentProject) {
          get().updateProject(activeProjectId, { settings });
        }
      },

      addScenario: (scenario) => {
        const { activeProjectId, currentProject } = get();
        if (activeProjectId && currentProject) {
          get().updateProject(activeProjectId, {
            scenarios: [...currentProject.scenarios, scenario],
          });
        }
      },

      deleteScenario: (scenarioId) => {
        const { activeProjectId, currentProject } = get();
        if (activeProjectId && currentProject) {
          get().updateProject(activeProjectId, {
            scenarios: currentProject.scenarios.filter(
              (s) => s.id !== scenarioId
            ),
          });
        }
      },
    }),
    {
      name: 'project-storage',
    }
  )
);

// Run Store
interface RunState {
  currentRun: RunSnapshot | null;
  lastRun: RunSnapshot | null;
  isComputing: boolean;
  progress: { stage: string; progress: number; total: number } | null;
  setCurrentRun: (run: RunSnapshot | null) => void;
  setLastRun: (run: RunSnapshot | null) => void;
  setComputing: (computing: boolean) => void;
  setProgress: (
    progress: { stage: string; progress: number; total: number } | null
  ) => void;
}

export const useRunStore = create<RunState>()((set) => ({
  currentRun: null,
  lastRun: null,
  isComputing: false,
  progress: null,

  setCurrentRun: (run) => set({ currentRun: run }),
  setLastRun: (run) => set({ lastRun: run }),
  setComputing: (computing) => set({ isComputing: computing }),
  setProgress: (progress) => set({ progress }),
}));

// UI Store
interface UIState {
  toasts: Toast[];
  modals: Modal[];
  wizardStep: number;
  progressFlags: Record<string, boolean>;
  sidebarCollapsed: boolean;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  openModal: (modal: Omit<Modal, 'id'>) => void;
  closeModal: (id: string) => void;
  setWizardStep: (step: number) => void;
  setProgressFlag: (key: string, value: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  modals: [],
  wizardStep: 0,
  progressFlags: {},
  sidebarCollapsed: false,

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  openModal: (modal) =>
    set((state) => ({
      modals: [...state.modals, { ...modal, id: Date.now().toString() }],
    })),

  closeModal: (id) =>
    set((state) => ({
      modals: state.modals.filter((m) => m.id !== id),
    })),

  setWizardStep: (step) => set({ wizardStep: step }),

  setProgressFlag: (key, value) =>
    set((state) => ({
      progressFlags: { ...state.progressFlags, [key]: value },
    })),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
