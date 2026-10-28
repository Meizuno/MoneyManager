// The app's confirmations: "Transaction added", "Couldn't save the plan".
// One place decides how they look, so every one of them is the same small
// card — the icon in a tinted circle like the income and expense tiles of
// the overview, green when it worked and rose when it did not.
const TONES = {
  success: {
    icon: "i-heroicons-check",
    class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: "i-heroicons-exclamation-triangle",
    class: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
} as const;

export const useNotice = () => {
  const toast = useToast();

  const show = (kind: keyof typeof TONES, title: string, description?: string) =>
    toast.add({
      title,
      description,
      color: kind,
      // The size here rather than in app.config: a slot there is added to
      // the default ("2xl md"), which is no size at all.
      avatar: {
        size: "md",
        icon: TONES[kind].icon,
        class: TONES[kind].class,
        ui: { icon: "size-4 text-current" },
      },
    });

  return {
    done: (title: string, description?: string) => show("success", title, description),
    failed: (title: string, description?: string) => show("error", title, description),
  };
};
