"use client";
import { login } from "@/actions/auth/login";
import React from "react";
import SocialIcon from "../global/icons";
import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";
import { captureEvent } from "@repo/posthog";

interface TwitchLoginProps {
  redirect: string | null;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
  disabled?: boolean;
  className?: string;
  source?: string;
}

export default function TwitchLogin({ redirect, text, disabled, size, variant, className, source }: TwitchLoginProps) {
  const handleClick = () => {
    // Fire before the server action: login() ends in a redirect to Twitch.
    captureEvent("login_clicked", { source });
    login(redirect);
  };

  return (
    <Button variant={variant} size={size} type="button" onClick={handleClick} disabled={disabled} className={className}>
      <span className={cn("mr-2 h-4 w-4 flex justify-center items-center")} aria-hidden="true">
        <SocialIcon icon="twitch" />
      </span>
      {text || "Twitch"}
    </Button>
  );
}
