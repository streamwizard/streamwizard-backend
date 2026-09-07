"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui";
import { captureEvent } from "@repo/posthog";

/*
 * The FAQ list as a client island, so opening a question can report which
 * one: `faq_opened` with the question text. Closing reports nothing.
 */
export function FaqAccordion({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      onValueChange={(question) => {
        if (question) captureEvent("faq_opened", { question });
      }}
    >
      {items.map(({ question, answer }) => (
        <AccordionItem key={question} value={question}>
          <AccordionTrigger className="text-left text-base">{question}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
