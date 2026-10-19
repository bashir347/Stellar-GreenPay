import ProjectCard from "./ProjectCard";

const meta = {
  title: "Components/ProjectCard",
  component: ProjectCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const baseProject = {
  id: "proj-123",
  name: "Amazon Reforestation Initiative",
  description: "Restoring degraded rainforest lands in the Amazon basin through native tree planting and community engagement.",
  category: "Reforestation",
  location: "Brazil",
  imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800",
  raisedXLM: "7500",
  goalXLM: "10000",
  co2OffsetKg: "15000",
  donorCount: 142,
  status: "active",
  walletAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-10-01T00:00:00Z",
};

type Story = { args: { project: typeof baseProject } };

export const ActiveProject: Story = {
  args: { project: { ...baseProject, status: "active" } },
};

export const FullyFunded: Story = {
  args: { 
    project: { 
      ...baseProject, 
      raisedXLM: "10000",
      status: "completed" 
    } 
  },
};

export const NoImage: Story = {
  args: {
    project: {
      ...baseProject,
      imageUrl: "",
    },
  },
};
