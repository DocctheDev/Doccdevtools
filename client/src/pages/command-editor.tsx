import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { insertCommandSchema, type Command, type Bot } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type CodeAnalysis = {
  suggestions: string[];
  security: string[];
  performance: string[];
};

export default function CommandEditor() {
  const { botId } = useParams();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertCommandSchema),
    defaultValues: {
      name: "",
      description: "",
      code: "",
    },
  });

  const { data: bot, isLoading: isBotLoading } = useQuery<Bot>({
    queryKey: [`/api/bots/${botId}`],
  });

  const { data: commands, isLoading: isCommandsLoading } = useQuery<Command[]>({
    queryKey: [`/api/bots/${botId}/commands`],
  });

  const { data: analysis, isLoading: isAnalysisLoading } = useQuery<CodeAnalysis>({
    queryKey: ["/api/analyze-code", form.watch("code")],
    queryFn: async () => {
      if (!form.watch("code")) return null;
      const res = await apiRequest("POST", "/api/analyze-code", {
        code: form.watch("code"),
      });
      return res.json();
    },
    enabled: !!form.watch("code"),
  });

  const createCommandMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      code: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/bots/${botId}/commands`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/bots/${botId}/commands`],
      });
      toast({ title: "Command created successfully" });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create command",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isBotLoading || isCommandsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Command Editor</h1>
          <p className="text-muted-foreground mt-2">
            Bot: {bot?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                createCommandMutation.mutate(data)
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="!help" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Displays help information"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command Code</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="font-mono"
                        rows={10}
                        placeholder="message.reply('Hello world!');"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={createCommandMutation.isPending}
              >
                {createCommandMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Command
              </Button>
            </form>
          </Form>
        </div>

        <div className="space-y-6">
          {analysis && !isAnalysisLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  AI Analysis
                </CardTitle>
                <CardDescription>
                  Real-time code analysis and suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.suggestions.length > 0 && (
                  <Alert>
                    <AlertTitle>Suggestions</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {analysis.suggestions.map((suggestion, i) => (
                          <li key={i}>{suggestion}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {analysis.security.length > 0 && (
                  <Alert>
                    <AlertTitle>Security Considerations</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {analysis.security.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {analysis.performance.length > 0 && (
                  <Alert>
                    <AlertTitle>Performance Tips</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {analysis.performance.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Existing Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {commands?.map((command) => (
                <div
                  key={command.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="font-semibold">{command.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {command.description}
                  </div>
                  <pre className="bg-muted p-2 rounded text-sm">
                    {command.code}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
