import * as React from "react"
import { cn } from "@/lib/utils"
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-sm border px-3 py-1 text-base shadow-sm transition-colors md:text-sm " +
        "bg-[#0a0a0f] border-[rgba(201,178,124,0.2)] text-white placeholder:text-white/20 " +
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[rgba(201,178,124,0.5)] " +
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"
export { Input }
