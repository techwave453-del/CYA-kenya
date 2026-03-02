import { usePwaUpdates } from "@/hooks/usePwaUpdates";

const PwaUpdateHandler = () => {
  // This component silently handles PWA updates
  usePwaUpdates();
  
  return null;
};

export default PwaUpdateHandler;
