declare module 'asana' {
  // New SDK style client interface
  interface Client {
    tasks: TasksResource;
    workspaces: WorkspacesResource;
    projects: ProjectsResource;
    sections: SectionsResource;
    stories: StoriesResource;
    attachments: AttachmentsResource;
    tags: TagsResource;
    users: UsersResource;
    useAccessToken(token: string): Client;
  }

  interface TasksResource {
    findById(taskId: string, options?: object): Promise<Task>;
    findByProject(projectId: string, options?: object): Promise<{ data: Task[] }>;
    findBySection(sectionId: string, options?: object): Promise<{ data: Task[] }>;
    update(taskId: string, data: object): Promise<Task>;
    addComment(taskId: string, data: object): Promise<Story>;
    addTag(taskId: string, data: object): Promise<object>;
    tags: TagsResource;
    getTask(taskId: string, options?: any): Promise<any>;
    getTasksForSection(sectionId: string, options?: any): Promise<any>;
    getTasksForProject(projectId: string, options?: any): Promise<any>;
    getSubtasksForTask(taskId: string, options?: any): Promise<any>;
    updateTask(taskId: string, data: any, options?: any): Promise<any>;
    addTagForTask(taskId: string, data: any, options?: any): Promise<any>;
    removeTagForTask(taskId: string, data: any, options?: any): Promise<any>;
  }

  interface Task {
    gid: string;
    name: string;
    notes?: string;
    html_notes?: string;
    completed: boolean;
    due_on?: string;
    due_at?: string;
    created_at: string;
    modified_at: string;
    assignee?: User;
    projects?: Project[];
    tags?: Tag[];
    custom_fields?: CustomField[];
    memberships?: Membership[];
    [key: string]: unknown;
  }

  interface WorkspacesResource {
    findById(workspaceId: string): Promise<Workspace>;
  }

  interface ProjectsResource {
    findById(projectId: string): Promise<Project>;
  }

  interface SectionsResource {
    findByProject(projectId: string): Promise<{ data: Section[] }>;
    getSectionsForProject(projectId: string, options?: any): Promise<any>;
    addTaskForSection(sectionId: string, data: any, options?: any): Promise<any>;
  }

  interface StoriesResource {
    findByTask(taskId: string): Promise<{ data: Story[] }>;
    getStoriesForTask(taskId: string, options?: any): Promise<any>;
    createStoryForTask(taskId: string, data: any, options?: any): Promise<any>;
  }

  interface AttachmentsResource {
    findByTask(taskId: string): Promise<{ data: Attachment[] }>;
    getAttachmentsForObject(objectId: string, options?: any): Promise<any>;
  }

  interface TagsResource {
    findByWorkspace(workspaceId: string): Promise<{ data: Tag[] }>;
    create(data: object): Promise<Tag>;
    createInWorkspace(workspaceId: string, data: object): Promise<Tag>;
    createTag(data: any, options?: any): Promise<any>;
    getTagsForWorkspace(workspaceId: string, options?: any): Promise<any>;
  }

  interface UsersResource {
    me(): Promise<User>;
  }

  interface Workspace {
    gid: string;
    name: string;
  }

  interface Project {
    gid: string;
    name: string;
  }

  interface Section {
    gid: string;
    name: string;
  }

  interface Story {
    gid: string;
    text: string;
    html_text?: string;
    created_at: string;
    created_by?: User;
    type: string;
  }

  interface Attachment {
    gid: string;
    name: string;
    download_url?: string;
    host?: string;
    view_url?: string;
  }

  interface Tag {
    gid: string;
    name: string;
  }

  interface User {
    gid: string;
    name: string;
    email?: string;
  }

  interface CustomField {
    gid: string;
    name: string;
    type: string;
    display_value?: string;
    number_value?: number;
    text_value?: string;
    enum_value?: { gid: string; name: string };
  }

  interface Membership {
    project?: Project;
    section?: Section;
  }

  // Old SDK style (ApiClient)
  class ApiClient {
    static instance: ApiClient;
    authentications: {
      token: {
        accessToken: string;
      };
      [key: string]: any;
    };
  }

  class TasksApiInstance {
    constructor(client: ApiClient);
    getTask(taskId: string, opts?: any): Promise<any>;
    updateTask(taskId: string, body: any, opts?: any): Promise<any>;
    addTagForTask(taskId: string, body: any, opts?: any): Promise<any>;
  }

  class StoriesApiInstance {
    constructor(client: ApiClient);
    getStoriesForTask(taskId: string, opts?: any): Promise<any>;
    createStoryForTask(taskId: string, body: any, opts?: any): Promise<any>;
  }

  // Global namespace Asana for imports like "import Asana from 'asana'"
  namespace Asana {
    export type Client = import('asana').Client;

    export namespace resources {
      export interface ResourceList<T> {
        data: T[];
        next_page?: {
          offset: string;
          path: string;
          uri: string;
        };
      }

      export namespace Tasks {
        export interface Type {
          gid: string;
          name: string;
          notes?: string;
          html_notes?: string;
          completed: boolean;
          completed_at?: string;
          created_at: string;
          modified_at: string;
          due_on?: string;
          due_at?: string;
          start_on?: string;
          start_at?: string;
          assignee?: { gid: string; name: string; email?: string };
          assignee_section?: { gid: string; name: string };
          followers?: Array<{ gid: string; name: string }>;
          parent?: { gid: string; name: string };
          projects?: Array<{ gid: string; name: string }>;
          tags?: Array<{ gid: string; name: string }>;
          memberships?: Array<{
            project: { gid: string; name: string };
            section?: { gid: string; name: string };
          }>;
          custom_fields?: Array<{
            gid: string;
            name: string;
            type: string;
            display_value?: string;
            enum_value?: { gid: string; name: string };
            number_value?: number;
            text_value?: string;
          }>;
          resource_subtype?: string;
          permalink_url?: string;
          num_subtasks?: number;
          num_likes?: number;
          liked?: boolean;
          [key: string]: unknown;
        }
      }
    }

    export const Client: {
      create(): Client;
    };

    export { ApiClient, TasksApiInstance, StoriesApiInstance };
  }

  function authorize(options: { credentials: { token: string } }): Client;

  export {
    Client,
    TasksResource,
    Task,
    WorkspacesResource,
    ProjectsResource,
    SectionsResource,
    StoriesResource,
    AttachmentsResource,
    TagsResource,
    UsersResource,
    Workspace,
    Project,
    Section,
    Story,
    Attachment,
    Tag,
    User,
    CustomField,
    Membership,
    ApiClient,
    TasksApiInstance,
    StoriesApiInstance,
    authorize,
    Asana,
  };

  export default Asana;
}
