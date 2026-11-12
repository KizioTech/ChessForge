import { useEffect, useState } from "react";
import { loadOpeningBook, type OpeningBook } from "./opening-book";

export function useOpeningBook(): OpeningBook | null {
  const [book, setBook] = useState<OpeningBook | null>(null);
  useEffect(() => {
    let live = true;
    loadOpeningBook().then(b => {
      if (live) setBook(b);
    });
    return () => {
      live = false;
    };
  }, []);
  return book;
}
