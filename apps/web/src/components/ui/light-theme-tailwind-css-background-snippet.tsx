import React from "react";
import { cn } from "@/lib/utils";

export interface RadialBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  greenColor?: string;
}

export const RadialBackground: React.FC<RadialBackgroundProps> = ({
  className,
  greenColor = "#1B5E3B",
  style,
  ...props
}) => {
  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 size-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#1B5E3B_100%)]",
        className
      )}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -10,
        width: "100%",
        height: "100%",
        backgroundColor: "#FFFFFF",
        background: `radial-gradient(125% 125% at 50% 10%, #ffffff 40%, ${greenColor} 100%)`,
        ...style,
      }}
      {...props}
    />
  );
};

export default RadialBackground;

