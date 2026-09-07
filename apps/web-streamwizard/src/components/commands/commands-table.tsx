"use client";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { Database } from "@repo/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { Switch } from "@repo/ui";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { toggleDefaultCommand, duplicateToCustomCommand } from "@/actions/commands/default-commands";

type DefaultCommand = Database["public"]["Tables"]["default_chat_commands"]["Row"] & {
  enabled: boolean;
  channelCommandId?: string;
};

interface CommandsTableProps {
  commands: DefaultCommand[];
}

export function CommandsTable({ commands }: CommandsTableProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const handleToggle = async (defaultCommandId: string, currentEnabled: boolean) => {
    setLoadingStates(prev => ({ ...prev, [defaultCommandId]: true }));
    
    try {
      await toggleDefaultCommand(defaultCommandId, !currentEnabled);
      toast.success(`Command ${!currentEnabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      toast.error("Failed to update command");
      console.error(error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [defaultCommandId]: false }));
    }
  };

  const handleDuplicate = async (commandId: string, commandName: string) => {
    try {
      await duplicateToCustomCommand(commandId);
      toast.success(`Command "${commandName}" duplicated to custom commands`);
    } catch (error) {
      toast.error("Failed to duplicate command");
      console.error(error);
    }
  };

  const getActionBadgeVariant = (action: string | null): "default" | "secondary" | "outline" => {
    if (!action) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Default Commands</h2>
          <p className="text-sm text-muted-foreground">
            Enable/disable default commands or duplicate them to create custom versions
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Command</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No default commands available.
                </TableCell>
              </TableRow>
            ) : (
              commands.map((command) => (
                <TableRow key={command.id}>
                  <TableCell>
                    <Switch
                      checked={command.enabled}
                      onCheckedChange={() => handleToggle(command.id, command.enabled)}
                      disabled={loadingStates[command.id]}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {command.command}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="truncate" title={command.message}>
                      {command.message}
                    </div>
                  </TableCell>
                  <TableCell>
                    {command.action ? (
                      <Badge variant={getActionBadgeVariant(command.action)}>
                        {command.action}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Text Only</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(command.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(command.id, command.command)}
                      title="Duplicate to custom commands"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="ml-2">Duplicate</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

