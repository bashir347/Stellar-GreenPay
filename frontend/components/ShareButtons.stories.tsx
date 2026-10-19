import ShareButtons from "./ShareButtons";

const meta = {
  title: "Components/ShareButtons",
  component: ShareButtons,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    copyState: {
      control: "select",
      options: ["idle", "copied"],
    },
  },
};

export default meta;

const baseArgs = {
  onTwitter: () => console.log("Twitter clicked"),
  onFacebook: () => console.log("Facebook clicked"),
  onCopyLink: () => console.log("Copy link clicked"),
};

type Story = { args: typeof baseArgs & { copyState?: "idle" | "copied" } };

export const DesktopIdle: Story = {
  args: { ...baseArgs, copyState: "idle" },
};

export const DesktopCopied: Story = {
  args: { ...baseArgs, copyState: "copied" },
};
