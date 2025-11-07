import { Toaster as Sonner } from "sonner";

const Toaster = ({
  ...props
}) => {
  // Use light theme as default if ThemeProvider is not available
  // This will work even without next-themes ThemeProvider
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }
      }
      {...props} />
  );
}

export { Toaster }
