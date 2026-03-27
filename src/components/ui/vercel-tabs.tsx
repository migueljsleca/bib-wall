"use client"

import * as React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, activeTab, onTabChange, ...props }, ref) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [internalActiveIndex, setInternalActiveIndex] = useState(0)
    const [hoverStyle, setHoverStyle] = useState({})
    const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" })
    const tabRefs = useRef<(HTMLDivElement | null)[]>([])
    const activeIndex = useMemo(() => {
      if (!activeTab) return internalActiveIndex

      const controlledIndex = tabs.findIndex((tab) => tab.id === activeTab)
      return controlledIndex >= 0 ? controlledIndex : internalActiveIndex
    }, [activeTab, internalActiveIndex, tabs])

    useEffect(() => {
      if (hoveredIndex !== null) {
        const hoveredElement = tabRefs.current[hoveredIndex]
        if (hoveredElement) {
          const { offsetLeft, offsetWidth } = hoveredElement
          setHoverStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          })
        }
      }
    }, [hoveredIndex])

    useEffect(() => {
      const activeElement = tabRefs.current[activeIndex]
      if (activeElement) {
        const { offsetLeft, offsetWidth } = activeElement
        setActiveStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        })
      }
    }, [activeIndex])

    useEffect(() => {
      requestAnimationFrame(() => {
        const firstElement = tabRefs.current[0]
        if (firstElement) {
          const { offsetLeft, offsetWidth } = firstElement
          setActiveStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          })
        }
      })
    }, [])

    return (
      <div 
        ref={ref} 
        className={cn("relative", className)} 
        {...props}
      >
        <div className="relative">
          {/* Hover Highlight */}
          <div
            className="absolute top-[1px] flex h-[28px] items-center rounded-[6px] bg-foreground/[0.06] transition-all duration-300 ease-out"
            style={{
              ...hoverStyle,
              opacity: hoveredIndex !== null ? 1 : 0,
            }}
          />

          {/* Active Indicator */}
          <div
            className="absolute bottom-[-6px] h-[1px] bg-foreground transition-all duration-300 ease-out"
            style={activeStyle}
          />

          {/* Tabs */}
          <div className="relative flex items-start space-x-[2px]">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                ref={(el) => (tabRefs.current[index] = el)}
                className={cn(
                  "h-[30px] cursor-pointer px-2.5 py-[7px] transition-colors duration-300",
                  index === activeIndex 
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  setInternalActiveIndex(index)
                  onTabChange?.(tab.id)
                }}
              >
                <div className="flex h-full items-center justify-center whitespace-nowrap text-[14px] leading-5">
                  {tab.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
)
Tabs.displayName = "Tabs"

export { Tabs }
