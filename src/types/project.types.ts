export interface Project {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  branchName?: string;
  localPath: string;
  folderName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  githubRepo?: string;
  branchName?: string;
  localPath?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}
