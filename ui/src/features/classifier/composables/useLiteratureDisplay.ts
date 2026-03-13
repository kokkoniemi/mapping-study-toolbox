import { computed, ref, type Ref } from "vue";
import { format as formatDate } from "date-fns";
import type { EnrichmentFieldProvenance } from "@shared/contracts";

import type { RecordItem } from "../../../helpers/api";
import { decodeHtmlEntities } from "../../../helpers/utils";

export type LiteratureDisplayItem = {
  key: string;
  title: string | null;
  year: string | number | null;
  forum: string | null;
  doi: string | null;
  url: string | null;
};

export type TopicDisplayItem = {
  key: string;
  displayName: string;
  score: number | null;
  field: string | null;
  subfield: string | null;
};

export type EnrichmentBadge = {
  label: string;
  level: "low" | "medium" | "high";
  score: number;
  tooltip: string;
};

const DOI_URL_PATTERN = /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i;

const normalizeDoi = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(DOI_URL_PATTERN, "$1")
    .trim();

  return normalized.length ? normalized : null;
};

const extractDoiFromUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const match = value.trim().match(DOI_URL_PATTERN);
  if (!match || !match[1]) {
    return null;
  }

  try {
    return normalizeDoi(decodeURIComponent(match[1]));
  } catch {
    return normalizeDoi(match[1]);
  }
};

const sanitizeAbstract = (value: string) =>
  value.replace("Abstract:\n", "").replace("Abstract\n", "").split("\n•\n").join("");

const enrichmentBadgeFromProvenance = (
  label: string,
  item: EnrichmentFieldProvenance | undefined,
): EnrichmentBadge | null => {
  if (!item) {
    return null;
  }

  const source = item.source ? `Source: ${item.source}` : "Source: n/a";
  const tooltip = `${item.provider.toUpperCase()} ${item.confidenceLevel} ${item.confidenceScore} - ${item.reason} (${item.enrichedAt})\n${source}`;
  return {
    label,
    level: item.confidenceLevel,
    score: item.confidenceScore,
    tooltip,
  };
};

export const useLiteratureDisplay = (currentItem: Ref<RecordItem | null>) => {
  const showReferences = ref(false);
  const showCitations = ref(false);
  const showTopics = ref(false);

  const referenceDisplayItems = computed<LiteratureDisplayItem[]>(() => {
    const crossrefReferences = currentItem.value?.referenceItems ?? [];
    return crossrefReferences.map((item) => ({
      key: item.key ?? `${item.doi ?? item.articleTitle ?? item.unstructured ?? "ref"}`,
      title: item.articleTitle
        ? decodeHtmlEntities(item.articleTitle)
        : (item.unstructured ? decodeHtmlEntities(item.unstructured) : null),
      year: item.year ?? null,
      forum: item.journalTitle ? decodeHtmlEntities(item.journalTitle) : null,
      doi: normalizeDoi(item.doi),
      url: null,
    }));
  });

  const citationDisplayItems = computed<LiteratureDisplayItem[]>(() => {
    const citations = currentItem.value?.openAlexCitationItems ?? [];
    return citations.map((item) => ({
      key: item.openAlexId ?? `${item.doi ?? item.title ?? "citation"}`,
      title: item.title ? decodeHtmlEntities(item.title) : null,
      year: item.year ?? null,
      forum: item.forum ? decodeHtmlEntities(item.forum) : null,
      doi: normalizeDoi(item.doi) ?? extractDoiFromUrl(item.url),
      url: item.url ?? null,
    }));
  });

  const authorDisplay = computed(() => {
    const details = currentItem.value?.authorDetails ?? [];
    if (Array.isArray(details) && details.length > 0) {
      const names = details
        .map((author) => {
          const family = author.family?.trim() ?? "";
          const given = author.given?.trim() ?? "";
          const name = author.name?.trim() ?? "";
          if (family && given) {
            return `${family}, ${given}`;
          }
          if (name) {
            return name;
          }
          return [given, family].filter(Boolean).join(" ").trim();
        })
        .filter((item) => item.length > 0)
        .map((item) => decodeHtmlEntities(item));

      if (names.length > 0) {
        return names.join("; ");
      }
    }

    return decodeHtmlEntities(currentItem.value?.author ?? "");
  });

  const affiliations = computed(() => {
    const values: string[] = [];
    const seen = new Set<string>();

    const pushUnique = (value: string | null | undefined) => {
      const normalized = value?.trim();
      if (!normalized) {
        return;
      }
      const decoded = decodeHtmlEntities(normalized);
      const key = decoded.toLocaleLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      values.push(decoded);
    };

    for (const author of currentItem.value?.authorDetails ?? []) {
      for (const affiliation of author.affiliations ?? []) {
        pushUnique(affiliation);
      }
    }

    for (const affiliation of currentItem.value?.openAlexAuthorAffiliations ?? []) {
      pushUnique(affiliation);
    }

    return values;
  });

  const affiliationsDisplay = computed(() => affiliations.value.join("; "));

  const topicDisplayItems = computed<TopicDisplayItem[]>(() => {
    const topics = currentItem.value?.openAlexTopicItems ?? [];
    return topics
      .filter((item) => item.displayName && item.displayName.trim().length > 0)
      .map((item) => ({
        key: item.id ?? `${item.displayName ?? "topic"}_${item.field ?? ""}_${item.subfield ?? ""}`,
        displayName: item.displayName ?? "",
        score: typeof item.score === "number" ? item.score : null,
        field: item.field ?? null,
        subfield: item.subfield ?? null,
      }));
  });

  const enrichmentBadges = computed<EnrichmentBadge[]>(() => {
    const recordProvenance = currentItem.value?.enrichmentProvenance ?? {};
    const forumProvenance = currentItem.value?.Forum?.enrichmentProvenance ?? {};

    const badges = [
      enrichmentBadgeFromProvenance("DOI", recordProvenance.doi),
      enrichmentBadgeFromProvenance("URL", recordProvenance.url),
      enrichmentBadgeFromProvenance("Forum", recordProvenance.forumId ?? forumProvenance.name),
      enrichmentBadgeFromProvenance("Jufo", forumProvenance.jufoLevel),
      enrichmentBadgeFromProvenance("Refs", recordProvenance.referenceItems),
      enrichmentBadgeFromProvenance("Citations", recordProvenance.openAlexCitationItems),
      enrichmentBadgeFromProvenance("Topics", recordProvenance.openAlexTopicItems),
    ];

    return badges.filter((item): item is EnrichmentBadge => item !== null);
  });

  const createdFormatted = computed(() => {
    const createdAt = currentItem.value?.createdAt;
    if (!createdAt) {
      return null;
    }
    return formatDate(new Date(createdAt), "dd.MM.yyyy HH:mm:ss ");
  });

  const modifiedFormatted = computed(() => {
    const updatedAt = currentItem.value?.updatedAt;
    if (!updatedAt) {
      return null;
    }
    return formatDate(new Date(updatedAt), "dd.MM.yyyy HH:mm:ss ");
  });

  const databaseList = computed(() => {
    const databases = currentItem.value?.databases;
    if (!Array.isArray(databases) || databases.length === 0) {
      return "-";
    }
    return databases.join(", ");
  });

  const forumName = computed(() => decodeHtmlEntities(currentItem.value?.Forum?.name ?? ""));
  const abstractText = computed(() => sanitizeAbstract(currentItem.value?.abstract ?? ""));

  const resetVisibility = () => {
    showReferences.value = false;
    showCitations.value = false;
    showTopics.value = false;
  };

  return {
    showReferences,
    showCitations,
    showTopics,
    referenceDisplayItems,
    citationDisplayItems,
    authorDisplay,
    affiliations,
    affiliationsDisplay,
    topicDisplayItems,
    enrichmentBadges,
    createdFormatted,
    modifiedFormatted,
    databaseList,
    forumName,
    abstractText,
    toggleReferencesVisibility: () => {
      showReferences.value = !showReferences.value;
    },
    toggleCitationsVisibility: () => {
      showCitations.value = !showCitations.value;
    },
    toggleTopicsVisibility: () => {
      showTopics.value = !showTopics.value;
    },
    resetVisibility,
  };
};
