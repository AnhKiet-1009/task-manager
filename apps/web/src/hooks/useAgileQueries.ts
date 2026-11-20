import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type CompleteSprintInput,
  type CreateIssueInput,
  type CreateProjectInput,
  type CreateSprintInput,
  type CreateWorkflowStateInput,
  type CreateWorkspaceInput,
  generateRankBetween,
  type MoveIssueInput,
  type UpdateIssueInput,
  type UpdateSprintInput,
  type UpdateWorkflowStateInput,
} from "@taskmanager/shared";
import {
  api,
  ApiError,
  type IssueListItem,
  type WorkflowStateDto,
} from "../lib/api";
import { sortByLexoRank } from "../lib/agileMeta";
import { queryKeys } from "../lib/queryClient";
import { useUiStore } from "../stores/uiStore";

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

// ==============================================
// Auth & Sandbox Hooks
// ==============================================

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLaunchSandbox() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  const setActiveWorkspaceId = useUiStore((s) => s.setActiveWorkspaceId);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);

  return useMutation({
    mutationFn: api.launchSandbox,
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      setActiveWorkspaceId(data.workspace.id);
      setActiveProjectId(data.project.id);
      setBoardSprintId(data.activeSprint.id);
      pushToast(
        `Đã mở Sandbox "${data.workspace.name}" (${data.issueCount} issues mẫu).`,
        "success",
      );
    },
    onError: (err) => {
      pushToast(
        getErrorMessage(err, "Không thể khởi chạy Demo Sandbox."),
        "error",
      );
    },
  });
}

export function useSignInEmail() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: api.signInEmail,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      pushToast("Đăng nhập thành công.", "success");
    },
    onError: (err) => {
      pushToast(
        getErrorMessage(err, "Email hoặc mật khẩu không chính xác."),
        "error",
      );
    },
  });
}

export function useSignUpEmail() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: api.signUpEmail,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      pushToast("Tạo tài khoản thành công.", "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể đăng ký tài khoản."), "error");
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const resetSessionState = useUiStore((s) => s.resetSessionState);
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: api.signOut,
    onSuccess: () => {
      qc.clear();
      resetSessionState();
      pushToast("Đã đăng xuất.", "info");
    },
  });
}

// ==============================================
// Workspace, Project, Sprint & Issue Queries
// ==============================================

export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.workspace(workspaceId ?? ""),
    queryFn: () => api.getWorkspace(workspaceId!).then((r) => r.workspace),
    enabled: Boolean(workspaceId),
  });
}

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => api.getProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useSprints(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.sprints(projectId ?? ""),
    queryFn: () => api.getSprints(projectId!).then((r) => r.sprints),
    enabled: Boolean(projectId),
  });
}

export function useProjectIssues(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.issues(projectId ?? ""),
    queryFn: () => api.getIssues(projectId!).then((r) => r.issues),
    enabled: Boolean(projectId),
  });
}

export function useIssueDetail(issueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issue(issueId ?? ""),
    queryFn: () => api.getIssue(issueId!).then((r) => r.issue),
    enabled: Boolean(issueId),
  });
}

// ==============================================
// Workspace & Project Mutations
// ==============================================

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  const setActiveWorkspaceId = useUiStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => api.createWorkspace(input),
    onSuccess: async ({ workspace }) => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      setActiveWorkspaceId(workspace.id);
      pushToast(`Đã tạo Workspace "${workspace.name}".`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể tạo Workspace."), "error");
    },
  });
}

export function useCreateProject(workspaceId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);

  return useMutation({
    mutationFn: (input: CreateProjectInput) => {
      if (!workspaceId) throw new Error("Chưa chọn Workspace.");
      return api.createProject(workspaceId, input);
    },
    onSuccess: async ({ project }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.me }),
        workspaceId
          ? qc.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) })
          : Promise.resolve(),
      ]);
      setActiveProjectId(project.id);
      pushToast(`Đã tạo Project ${project.key} — ${project.name}.`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể tạo Project."), "error");
    },
  });
}

// ==============================================
// Workflow State Mutations (Custom Columns & WIP)
// ==============================================

export function useCreateWorkflowState(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: (input: CreateWorkflowStateInput) => {
      if (!projectId) throw new Error("Chưa chọn Project.");
      return api.createWorkflowState(projectId, input);
    },
    onSuccess: async ({ state }) => {
      if (projectId) {
        await qc.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      }
      pushToast(`Đã thêm cột "${state.name}".`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể thêm cột trạng thái."), "error");
    },
  });
}

export function useUpdateWorkflowState(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({
      stateId,
      input,
    }: {
      stateId: string;
      input: UpdateWorkflowStateInput;
    }) => {
      if (!projectId) throw new Error("Chưa chọn Project.");
      return api.updateWorkflowState(projectId, stateId, input);
    },
    onSuccess: async ({ state }) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
        ]);
      }
      pushToast(`Đã cập nhật cột "${state.name}".`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể cập nhật cột."), "error");
    },
  });
}

export function useDeleteWorkflowState(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: (stateId: string) => {
      if (!projectId) throw new Error("Chưa chọn Project.");
      return api.deleteWorkflowState(projectId, stateId);
    },
    onSuccess: async () => {
      if (projectId) {
        await qc.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      }
      pushToast("Đã xóa cột trạng thái.", "info");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể xóa cột này."), "error");
    },
  });
}

// ==============================================
// Sprint Mutations
// ==============================================

export function useCreateSprint(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: (input: CreateSprintInput) => {
      if (!projectId) throw new Error("Chưa chọn Project.");
      return api.createSprint(projectId, input);
    },
    onSuccess: async ({ sprint }) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
        ]);
      }
      pushToast(`Đã tạo "${sprint.name}".`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể tạo Sprint."), "error");
    },
  });
}

export function useUpdateSprint(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({
      sprintId,
      input,
    }: {
      sprintId: string;
      input: UpdateSprintInput;
    }) => api.updateSprint(sprintId, input),
    onSuccess: async () => {
      if (projectId) {
        await qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) });
      }
      pushToast("Đã cập nhật Sprint.", "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể cập nhật Sprint."), "error");
    },
  });
}

export function useStartSprint(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);

  return useMutation({
    mutationFn: (sprintId: string) => api.startSprint(sprintId),
    onSuccess: async ({ sprint }) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
        ]);
      }
      setBoardSprintId(sprint.id);
      pushToast(`Đã bắt đầu "${sprint.name}".`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể bắt đầu Sprint."), "error");
    },
  });
}

export function useCompleteSprint(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({
      sprintId,
      input,
    }: {
      sprintId: string;
      input: CompleteSprintInput;
    }) => api.completeSprint(sprintId, input),
    onSuccess: async (res) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
        ]);
      }
      pushToast(
        `Hoàn thành Sprint! Velocity: ${res.completedPoints} pts (chuyển ${res.movedIncompleteCount} issue chưa xong).`,
        "success",
      );
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể hoàn thành Sprint."), "error");
    },
  });
}

// ==============================================
// Issue Mutations + 0ms Optimistic LexoRank Move
// ==============================================

export function useCreateIssue(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: (input: CreateIssueInput) => {
      if (!projectId) throw new Error("Chưa chọn Project.");
      return api.createIssue(projectId, input);
    },
    onSuccess: async ({ issue }) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
        ]);
      }
      pushToast(`Đã tạo ${issue.identifier}: ${issue.title}`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể tạo Issue."), "error");
    },
  });
}

export function useUpdateIssue(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({
      issueId,
      input,
    }: {
      issueId: string;
      input: UpdateIssueInput;
    }) => api.updateIssue(issueId, input),
    onSuccess: async ({ issue }) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.issue(issue.id) }),
        ]);
      }
      pushToast(`Đã cập nhật ${issue.identifier}.`, "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể cập nhật Issue."), "error");
    },
  });
}

export function useDeleteIssue(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: (issueId: string) => api.deleteIssue(issueId),
    onSuccess: async () => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
        ]);
      }
      pushToast("Đã xóa Issue.", "info");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể xóa Issue."), "error");
    },
  });
}

/**
 * 0ms Optimistic LexoRank Move mutation with automatic rollback on RBAC/network errors
 * and real-time WIP Limit warning toast.
 */
export function useMoveIssue(
  projectId: string | null,
  workflowStates: WorkflowStateDto[],
) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({
      issueId,
      input,
    }: {
      issueId: string;
      input: MoveIssueInput;
    }) => api.moveIssue(issueId, input),

    onMutate: async ({ issueId, input }) => {
      if (!projectId) return { previous: undefined };
      const key = queryKeys.issues(projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<IssueListItem[]>(key);

      if (previous) {
        let optimisticRank: string;
        try {
          optimisticRank = generateRankBetween(
            input.prevPosition,
            input.nextPosition,
          );
        } catch {
          optimisticRank = generateRankBetween(null, null);
        }

        const nextState =
          workflowStates.find((s) => s.id === input.stateId) ?? null;

        const nextIssues = sortByLexoRank(
          previous.map((item) =>
            item.id === issueId
              ? {
                  ...item,
                  stateId: input.stateId,
                  state: nextState ?? item.state,
                  sprintId:
                    input.sprintId !== undefined ? input.sprintId : item.sprintId,
                  position: optimisticRank,
                }
              : item,
          ),
        );

        qc.setQueryData<IssueListItem[]>(key, nextIssues);
      }

      return { previous };
    },

    onSuccess: (res) => {
      if (res.wipWarning) {
        pushToast(
          `Cảnh báo WIP: Cột "${res.wipWarning.stateName}" đang có ${res.wipWarning.currentCount}/${res.wipWarning.wipLimit} issues.`,
          "warning",
        );
      }
    },

    onError: (err, _vars, ctx) => {
      if (projectId && ctx?.previous) {
        qc.setQueryData(queryKeys.issues(projectId), ctx.previous);
      }
      pushToast(
        getErrorMessage(err, "Không thể di chuyển Issue. Đã hoàn tác vị trí."),
        "error",
      );
    },

    onSettled: async (_data, _err, vars) => {
      if (projectId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) }),
          qc.invalidateQueries({ queryKey: queryKeys.issue(vars.issueId) }),
        ]);
      }
    },
  });
}

export function useCreateComment(projectId: string | null) {
  const qc = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  return useMutation({
    mutationFn: ({ issueId, bodyMd }: { issueId: string; bodyMd: string }) =>
      api.createComment(issueId, bodyMd),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: queryKeys.issue(vars.issueId) });
      if (projectId) {
        await qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) });
      }
      pushToast("Đã thêm bình luận.", "success");
    },
    onError: (err) => {
      pushToast(getErrorMessage(err, "Không thể gửi bình luận."), "error");
    },
  });
}
