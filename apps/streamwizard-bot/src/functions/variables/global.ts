// ./variables/global.ts
import { format } from "date-fns";
import type { BaseContext, VariableResolver, FlexibleResolver } from "../resolveVariables";

// Global context doesn't need any additional services
export type GlobalContext = BaseContext;

// Global variable resolvers - no dependencies required (mix of string and flexible resolvers)
export const GlobalVariableResolvers: Record<string, VariableResolver<GlobalContext> | FlexibleResolver<GlobalContext>> = {
  // Random generators
  random_number: async () => {
    return Math.floor(Math.random() * 100 + 1);
  },
  
  random_string: async () => {
    return Math.random().toString(36).substring(2, 15);
  },
  
  random_boolean: async () => {
    return Math.random() > 0.5 ? "true" : "false";
  },



  // Time and date
  current_time: async () => {
    return format(new Date(), "HH:mm:ss");
  },

  current_date: async () => {
    return format(new Date(), "yyyy-MM-dd");
  },

  current_datetime: async () => {
    return format(new Date(), "yyyy-MM-dd HH:mm:ss");
  },

  timestamp: async () => {
    return Date.now().toString();
  },

  day_of_week: async () => {
    return format(new Date(), "EEEE");
  },

  month_name: async () => {
    return format(new Date(), "MMMM");
  },  
};

export default GlobalVariableResolvers;