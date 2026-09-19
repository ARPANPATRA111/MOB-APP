import { useCallback, useEffect, useRef, useState } from "react";
import {
  listProductPage,
  type ProductPageOptions,
  type ProductRecord,
} from "../repositories/productRepository";
import { useLiveData } from "../services/dataEvents";

export function useProductCatalog(
  query: string,
  stock: ProductPageOptions["stock"] = "all",
  sort: ProductPageOptions["sort"] = "name",
) {
  const [search, setSearch] = useState(query);
  const [rows, setRows] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setMore] = useState(false);
  const rowsRef = useRef<ProductRecord[]>([]);
  const sequence = useRef(0);
  const fetching = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 220);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  const load = useCallback(
    (append = false) => {
      if (append && fetching.current) return;
      const id = ++sequence.current;
      fetching.current = true;
      setLoading(true);
      setError("");
      const last = append ? rowsRef.current.at(-1) : undefined;
      const after = last
        ? {
            id: last.id,
            value:
              sort === "name"
                ? last.name
                : sort === "stock-asc"
                  ? last.stockQuantity
                  : last.priceCents,
          }
        : undefined;
      if (!append) {
        rowsRef.current = [];
        setRows([]);
      }
      void listProductPage({ query: search, stock, sort, after })
        .then((next) => {
          if (id !== sequence.current) return;
          rowsRef.current = append ? [...rowsRef.current, ...next] : next;
          setRows(rowsRef.current);
          setMore(next.length === 40);
        })
        .catch((e) => {
          if (id === sequence.current) setError(e.message);
        })
        .finally(() => {
          if (id === sequence.current) {
            fetching.current = false;
            setLoading(false);
          }
        });
    },
    [search, stock, sort],
  );
  const refresh = useCallback(() => load(), [load]);
  useLiveData(refresh);
  return {
    rows,
    loading,
    error,
    hasMore,
    refresh,
    loadMore: () => {
      if (hasMore) load(true);
    },
  };
}
