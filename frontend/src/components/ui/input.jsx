import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors md:text-sm " +
        "bg-[#161616] border-white/10 text-white placeholder:text-white/40 " +
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0F1C2E] focus-visible:border-[#0F1C2E] " +
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
