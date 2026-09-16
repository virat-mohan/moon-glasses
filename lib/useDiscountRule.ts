"use client";

import { useEffect, useState } from "react";
import type { DiscountRule } from "@/lib/discounts";

export function useDiscountRule() {
  const [rule, setRule] = useState<DiscountRule | null>(null);

  useEffect(() => {
    fetch("/api/discount-rules")
      .then((res) => res.json())
      .then((data) => setRule(data.rule))
      .catch(() => setRule(null));
  }, []);

  return rule;
}
