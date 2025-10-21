import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { Icon } from '@/components/features/Icon';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/components/ui/sonner';
import { AgentStatus, AgentType } from '@/entities/Agent';
import { useCoreStore, useUIStore } from '@/stores';
import React, { useEffect, useMemo, useState } from 'react';

export const ProjectList: React.FC = () => {
  // Core store subscriptions with granular selectors following TRD patterns
  const projectsMap = useCoreStore((state) => state.projects);
  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const agentsMap = useCoreStore((state) => state.agents);
  const streamingStates = useCoreStore((state) => state.streamingStates);

  // Convert Maps to arrays with memoization to prevent re-renders
  // Filter out invalid projects (those without required fields like githubRepo and branchName)
  const projects = useMemo(() => {
    return Array.from(projectsMap.values()).filter(
      (project) => project.githubRepo && project.branchName && project.folderName
    );
  }, [projectsMap]);
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap]);

  // Core store actions
  const selectProject = useCoreStore((state) => state.selectProject);
  const selectAgent = useCoreStore((state) => state.selectAgent);
  const createAgent = useCoreStore((state) => state.createAgent);
  const deleteAgent = useCoreStore((state) => state.deleteAgent);
  const deleteProject = useCoreStore((state) => state.deleteProject);
  const loadProjects = useCoreStore((state) => state.loadProjects);
  const loadAgents = useCoreStore((state) => state.loadAgents);

  // Worktree stats from CoreStore
  const worktreeStats = useCoreStore((state) => state.worktreeStats);

  // UI store for project creation modal
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);

  // Track which worktrees are expanded to show agents
  const [, setExpandedProjects] = useState<Set<string>>(new Set());

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    projectId: string | null;
    agentId?: string | null;
  }>({
    isOpen: false,
    projectId: null,
    agentId: null,
  });

  // Load initial data on component mount
  useEffect(() => {
    void loadProjects();
    void loadAgents();
  }, []); // Empty dependency array - only run once on mount

  // Auto-select first project when data is loaded
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const firstProject = projects[0];
      if (firstProject.id) {
        void selectProject(firstProject.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]); // Trigger when projects are loaded

  const handleDelete = async (e: React.MouseEvent, projectId: string, agentId?: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, projectId, agentId: agentId || null });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.agentId) {
      // Delete agent
      try {
        await deleteAgent(deleteConfirm.agentId);
        toastSuccess('Agent deleted successfully');
        setDeleteConfirm({ isOpen: false, projectId: null, agentId: null });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent';
        toastError(errorMessage);
      }
    } else if (deleteConfirm.projectId) {
      // Delete worktree
      try {
        const wasSelectedProject = deleteConfirm.projectId === selectedProjectId;
        await deleteProject(deleteConfirm.projectId);
        toastSuccess('Worktree deleted successfully');
        setDeleteConfirm({ isOpen: false, projectId: null, agentId: null });

        // If the deleted project was selected, select the first remaining project
        if (wasSelectedProject && projects.length > 1) {
          const remainingProjects = projects.filter((p) => p.id !== deleteConfirm.projectId);
          if (remainingProjects.length > 0) {
            await selectProject(remainingProjects[0].id);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete worktree';
        toastError(errorMessage);
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, projectId: null, agentId: null });
  };

  const toggleProjectExpanded = (_e: React.MouseEvent, projectId: string) => {
    _e.stopPropagation();
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };
  // Prevent unused variable warning
  void toggleProjectExpanded;

  const handleAddAgent = async (_e: React.MouseEvent, projectId: string) => {
    _e.stopPropagation();
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project?.folderName) {
        toastError('Invalid project');
        return;
      }

      // Get existing agents for this project
      const projectAgents = getProjectAgents(project.folderName);
      if (projectAgents.length >= 5) {
        toastError('Maximum 5 agents per worktree');
        return;
      }

      // Create new agent with standardized name
      const agentNumber = projectAgents.length + 1;
      const newAgent = await createAgent({
        title: `Session ${agentNumber}`,
        content: '',
        type: AgentType.TEXT,
        projectId: project.folderName,
        tags: [],
        resourceIds: [],
      });

      toastSuccess(`Session ${agentNumber} created`);

      // Reload agents to ensure UI is in sync
      await loadAgents();

      // Expand the project to show the new agent
      setExpandedProjects((prev) => new Set([...prev, projectId]));

      // Select the newly created agent after a small delay to ensure state updates
      setTimeout(async () => {
        selectProject(projectId);
        await selectAgent(newAgent.id);
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent';
      toastError(errorMessage);
    }
  };
  // Prevent unused variable warning
  void handleAddAgent;

  const handleSelectAgent = async (_e: React.MouseEvent, projectId: string, agentId: string) => {
    _e.stopPropagation();
    console.log('Selecting agent:', agentId, 'in project:', projectId);

    // Check if we're already in the project
    if (selectedProjectId !== projectId) {
      // Pass true to skip automatic agent selection since we're about to select a specific agent
      await selectProject(projectId, true);
    }

    await selectAgent(agentId);
  };
  // Prevent unused variable warning
  void handleSelectAgent;

  const handleAddProject = () => {
    setShowProjectCreation(true);
  };

  // Get agents for a specific project
  const getProjectAgents = (projectFolderName: string | undefined) => {
    if (!projectFolderName) return [];
    return agents.filter((agent) => agent.projectId === projectFolderName);
  };

  // SVG Status Icons - custom SVG to avoid pixelation
  const StatusIcon: React.FC<{
    status: AgentStatus;
    size?: number;
    className?: string;
    isStreaming?: boolean;
  }> = ({ status, size = 12, isStreaming = false }) => {
    const getStatusColor = (status: AgentStatus, isStreaming: boolean): string => {
      // If streaming, always show green for better visibility
      if (isStreaming) {
        return '#10b981'; // Green for better visibility
      }

      switch (status) {
        case AgentStatus.COMPLETED:
          return 'var(--color-success)';
        case AgentStatus.IN_PROGRESS:
          return 'var(--color-warning)';
        case AgentStatus.REVIEW:
          return 'var(--color-error)';
        case AgentStatus.DRAFT:
        default:
          return 'rgb(var(--color-text-muted))';
      }
    };

    const color = getStatusColor(status, isStreaming);

    // Show indicator as SVG for consistency
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ minWidth: `${size}px`, minHeight: `${size}px` }}
        className={isStreaming ? 'task-indicator--active' : ''}
      >
        <circle cx="12" cy="12" r="8" fill={color} />
      </svg>
    );
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  // Prevent unused variable warning
  void formatTime;

  // Format token count display
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };
  // Prevent unused variable warning
  void formatTokens;

  // Get project metrics from worktreeStats
  const getProjectMetrics = useMemo(() => {
    return (project: any) => {
      // Use folderName as the key since that's what agent.projectId uses
      const projectKey = project.folderName || project.id;
      const stats = worktreeStats?.[projectKey];
      if (!stats) {
        return {
          tokens: 0,
          time: 0,
        };
      }

      // Display cumulative token totals (input + output) for real-time updates during streaming
      const tokens = (stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0);

      // Get time in seconds (rounded) - use totalStreamingTime for cumulative time
      // If currently streaming, add the current duration to the total
      let timeInMs = stats.totalStreamingTime || 0;
      if (stats.currentStreamStartTime) {
        // Currently streaming, add current duration
        timeInMs += Date.now() - stats.currentStreamStartTime;
      }
      const timeInSeconds = Math.round(timeInMs / 1000);

      return {
        tokens: tokens,
        time: timeInSeconds,
      };
    };
  }, [worktreeStats]);
  // Prevent unused variable warning
  void getProjectMetrics;

  // Get the project name for the delete confirmation
  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.branchName || project?.name || 'this worktree';
  };

  // Get the agent name for the delete confirmation
  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.title || 'this agent';
  };

  // Group projects by repository
  const groupedProjects = useMemo(() => {
    const groups = new Map<string, typeof projects>();

    projects.forEach((project) => {
      // Extract repo name from githubRepo (required field - no fallback)
      if (!project.githubRepo) return; // Skip projects without a repo URL

      const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';

      if (!groups.has(repoName)) {
        groups.set(repoName, []);
      }
      groups.get(repoName)!.push(project);
    });

    return groups;
  }, [projects]);

  // Track which repos are expanded - initialize with all repos expanded
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    groupedProjects.forEach((_, repoName) => {
      initialExpanded.add(repoName);
    });
    return initialExpanded;
  });

  // Auto-expand repos when new repos are added
  useEffect(() => {
    setExpandedRepos((prev) => {
      const newSet = new Set(prev);
      groupedProjects.forEach((_, repoName) => {
        newSet.add(repoName);
      });
      return newSet;
    });
  }, [groupedProjects]);

  const toggleRepoExpanded = (e: React.MouseEvent, repoName: string) => {
    e.stopPropagation();
    setExpandedRepos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(repoName)) {
        newSet.delete(repoName);
      } else {
        newSet.add(repoName);
      }
      return newSet;
    });
  };

  return (
    <div
      id="project-list"
      data-component="ProjectList"
      className="flex flex-col h-full bg-surface project-list-container"
    >
      {/* Header */}
      <div>
        <div
          id="project-list-header"
          data-section="worktree-header"
          className="flex items-center justify-between px-3 h-10 worktree-header"
        >
          <h3 className="text-text text-sm font-medium worktree-title">Projects</h3>
          <Button
            id="add-project-btn"
            data-action="add-project"
            variant="outline"
            size="icon-sm"
            className="bg-button-special shadow-xs"
            onClick={handleAddProject}
            title="Add new project"
          >
            <Icon name="plus" size={14} />
          </Button>
        </div>
      </div>

      {/* Project items container */}
      <div
        id="project-list-items"
        data-section="worktree-items"
        className="flex-1 overflow-y-auto overflow-x-hidden worktree-items-container"
      >
        {projects.length === 0 ? (
          <div
            id="worktree-empty-state"
            data-state="empty"
            className="flex justify-center h-full px-4 py-4 worktree-empty-state"
          ></div>
        ) : (
          Array.from(groupedProjects.entries()).map(([repoName, repoProjects]) => {
            const isRepoExpanded = expandedRepos.has(repoName);

            return (
              <div key={repoName} className="mb-2">
                {/* Repository header */}
                <div
                  className="group px-3 py-1.5 cursor-pointer hover:bg-surface-hover transition-colors flex items-center gap-2"
                  onClick={(e) => toggleRepoExpanded(e, repoName)}
                >
                  <Icon
                    name={isRepoExpanded ? 'chevron-down' : 'chevron-right'}
                    size={14}
                    className="text-text-muted flex-shrink-0"
                  />
                  <span className="text-text text-sm font-semibold truncate">{repoName}</span>
                </div>

                {/* Worktrees under this repo */}
                {isRepoExpanded && (
                  <div className="ml-2">
                    {repoProjects.map((project) => {
                      const projectAgents = getProjectAgents(project.folderName);
                      const isSelected = project.id === selectedProjectId;

                      // Check if any agent for this project is currently streaming
                      const isAnyAgentStreaming = projectAgents.some(
                        (agent) => streamingStates.get(agent.id) || false
                      );

                      return (
                        <div
                          key={project.id}
                          id={`worktree-${project.id}`}
                          data-project-id={project.id}
                          data-worktree="item"
                          data-selected={isSelected}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select worktree ${project.branchName}`}
                          className={`group px-2 py-0.5 cursor-pointer hover:bg-surface-hover transition-colors rounded ${
                            isSelected ? 'bg-surface-active selected' : ''
                          }`}
                          onClick={async () => {
                            await selectProject(project.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void selectProject(project.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <StatusIcon
                                status={AgentStatus.DRAFT}
                                isStreaming={isAnyAgentStreaming}
                              />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span
                                  className="text-text text-sm truncate"
                                  title={project.branchName}
                                >
                                  {project.branchName}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 hover:text-error flex-shrink-0"
                              onClick={(e) => handleDelete(e, project.id)}
                              title="Delete worktree"
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.agentId ? 'Delete Agent' : 'Delete Worktree'}
        message={
          deleteConfirm.agentId
            ? `Are you sure you want to delete "${getAgentName(deleteConfirm.agentId)}"? This will remove the agent and its conversation history.`
            : `Are you sure you want to delete "${getProjectName(deleteConfirm.projectId || '')}"? This will remove the worktree and all associated data.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
