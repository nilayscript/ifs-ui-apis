import { useState, useRef, useCallback } from "react";
import {
  Select,
  Tag,
  Card,
  Typography,
  Space,
  Alert,
  Collapse,
  Spin,
} from "antd";
import {
  GlobalOutlined,
  ApiOutlined,
  FilterOutlined,
  CodeOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";

const API_BASE = "https://ifs-extractor.onrender.com";

const HTTP_METHODS = ["GET", "PUT", "PATCH", "POST", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const DEBOUNCE_MS = 300;
const PAGE_LIMIT = 20;

const { Title, Text, Paragraph } = Typography;

interface EntityOption {
  method: string;
  name: string;
  id: number;
  has_nested: boolean;
}

interface PayloadField {
  key: string;
  required: boolean;
}

type FieldValue = string | PayloadField;

interface NestedEntity {
  name: string;
  description: string;
  url: string;
  filters: FieldValue[] | null;
  payload_fields: FieldValue[] | null;
  response_fields: FieldValue[] | null;
  id: number;
  method: string;
}

interface EntityDetails {
  name: string;
  description: string;
  url: string;
  filters: FieldValue[] | null;
  payload_fields: FieldValue[] | null;
  response_fields: FieldValue[] | null;
  nested_entities?: Record<HttpMethod, NestedEntity[]>;
  id: number;
  method: string;
}

const App = () => {
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod | null>(null);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityLoading, setEntityLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityDetails, setEntityDetails] = useState<EntityDetails | null>(
    null
  );
  const [selectedNestedEntity, setSelectedNestedEntity] =
    useState<NestedEntity | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [selectedNestedEntityId, setSelectedNestedEntityId] = useState<
    number | null
  >(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEntities = useCallback(
    async (query: string, pageNum: number, method: string, append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query || "",
          method: method,
          page: String(pageNum),
          limit: String(PAGE_LIMIT),
        });
        const res = await fetch(`${API_BASE}/api/entities/search?${params}`);
        const data = await res.json();

        const results = data.results || [];
        setEntities((prev) => (append ? [...prev, ...results] : results));
        setHasMore(data.pagination?.has_more || false);
        setPage(pageNum);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleMethodChange = (method: HttpMethod | undefined) => {
    setSelectedMethod(method ?? null);
    setEntities([]);
    setSearchQuery("");
    setPage(1);
    setHasMore(false);
    setEntityDetails(null);
    setSelectedNestedEntity(null);
    setSelectedEntityId(null);
    setSelectedNestedEntityId(null);
    if (method) {
      fetchEntities("", 1, method);
    }
  };

  const handleEntitySearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (selectedMethod) {
        fetchEntities(query, 1, selectedMethod);
      }
    }, DEBOUNCE_MS);
  };

  const handlePopupScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;

    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      hasMore &&
      !loading &&
      selectedMethod
    ) {
      fetchEntities(searchQuery, page + 1, selectedMethod, true);
    }
  };

  const handleEntitySelect = async (entityId: number | undefined) => {
    setSelectedEntityId(entityId ?? null);
    setSelectedNestedEntity(null);
    setSelectedNestedEntityId(null);

    if (!entityId) {
      setEntityDetails(null);
      return;
    }

    setEntityLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/entity/${entityId}`);
      const data = await res.json();
      setEntityDetails(data);
    } catch (err) {
      console.error("Fetch entity failed:", err);
    } finally {
      setEntityLoading(false);
    }
  };

  const handleNestedEntitySelect = (entity: NestedEntity | undefined) => {
    setSelectedNestedEntity(entity ?? null);
    setSelectedNestedEntityId(entity?.id ?? null);
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "green",
      POST: "blue",
      PUT: "orange",
      PATCH: "gold",
      DELETE: "red",
    };
    return colors[method] || "default";
  };

  const getNestedEntities = (): NestedEntity[] => {
    if (!entityDetails || !selectedMethod) return [];
    return entityDetails.nested_entities?.[selectedMethod] ?? [];
  };

  const getFieldLabel = (field: FieldValue): string => {
    if (typeof field === "string") {
      return field;
    }
    return field.key;
  };

  const isRequired = (field: FieldValue): boolean => {
    if (typeof field === "object" && "required" in field) {
      return field.required;
    }
    return false;
  };

  const renderTags = (items: FieldValue[] | null | undefined) => {
    if (!items || items.length === 0) {
      return <Text type="secondary">No items available</Text>;
    }
    return (
      <Space wrap size="middle">
        {items.map((item, index) => (
          <Tag
            key={index}
            color={isRequired(item) ? "red" : "blue"}
            className="text-sm px-3 py-1 leading-relaxed"
          >
            {getFieldLabel(item)}
            {isRequired(item) && <span className="ml-1">*</span>}
          </Tag>
        ))}
      </Space>
    );
  };

  const renderEntityDetails = (entity: EntityDetails | NestedEntity) => {
    const isNested = !("nested_entities" in entity);

    return (
      <Card
        title={
          <Space size="middle">
            <ApiOutlined className="text-lg" />
            <Text strong className="text-base">
              {entity.name}
            </Text>
            <Tag
              color={getMethodColor(entity.method)}
              className="text-sm px-3 py-1"
            >
              {entity.method}
            </Tag>
            {isNested && (
              <Tag color="purple" className="text-sm px-3 py-1">
                Nested Entity
              </Tag>
            )}
          </Space>
        }
        className="shadow-sm"
      >
        <div className="space-y-8">
          {entity.description && (
            <Paragraph className="text-base">{entity.description}</Paragraph>
          )}

          <div>
            <div className="flex items-center gap-3 mb-4">
              <GlobalOutlined className="text-slate-500" />
              <Text strong>API Endpoint</Text>
            </div>
            <Card size="small" className="bg-slate-50">
              <Text code copyable className="text-sm">
                {entity.url}
              </Text>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <FilterOutlined className="text-slate-500" />
              <Text strong>Available Filters</Text>
            </div>
            {renderTags(entity.filters)}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <CodeOutlined className="text-slate-500" />
              <Text strong>Response Fields</Text>
            </div>
            {renderTags(entity.response_fields)}
          </div>

          {entity.payload_fields && entity.payload_fields.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <DatabaseOutlined className="text-slate-500" />
                <Text strong>Payload Fields</Text>
              </div>
              {renderTags(entity.payload_fields)}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const nestedEntities = getNestedEntities();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 px-8 py-8">
        <Title level={2} className="!mb-2">
          IFS API Explorer
        </Title>
        <Text type="secondary" className="text-base">
          Discover and explore IFS CustomerOrderHandling API entities
        </Text>
      </div>

      <div className="max-w-6xl mx-auto p-10">
        <Card className="shadow-sm border border-slate-200">
          <Space direction="vertical" size={32} className="w-full">
            <div>
              <Title level={4} className="!mb-6">
                Search Configuration
              </Title>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <Text strong className="text-base block mb-3">
                    HTTP Method
                  </Text>
                  <Select
                    placeholder="Select HTTP Method"
                    className="w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selection-item]:!leading-[40px] [&_.ant-select-selection-placeholder]:!leading-[40px]"
                    size="large"
                    allowClear
                    options={HTTP_METHODS.map((m) => ({
                      label: (
                        <Space size="middle" className="py-1">
                          <Tag
                            color={getMethodColor(m)}
                            className="text-sm px-3 py-0.5"
                          >
                            {m}
                          </Tag>
                          <span>Method</span>
                        </Space>
                      ),
                      value: m,
                    }))}
                    onChange={handleMethodChange}
                    value={selectedMethod}
                  />
                </div>

                {selectedMethod && (
                  <div>
                    <Text strong className="text-base block mb-3">
                      Entity Search
                    </Text>
                    <Select
                      showSearch
                      allowClear
                      placeholder={`Search ${selectedMethod} entities...`}
                      className="w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selection-item]:!leading-[40px] [&_.ant-select-selection-placeholder]:!leading-[40px] [&_.ant-select-selection-search-input]:!h-[40px]"
                      size="large"
                      loading={loading}
                      filterOption={false}
                      onSearch={handleEntitySearch}
                      onChange={handleEntitySelect}
                      onPopupScroll={handlePopupScroll}
                      value={selectedEntityId}
                      options={entities.map((e) => ({
                        label: (
                          <Space size="middle" className="py-1">
                            <Text strong>{e.name}</Text>
                            {e.has_nested && (
                              <Tag color="cyan" className="text-xs px-2 py-0.5">
                                Has Nested
                              </Tag>
                            )}
                          </Space>
                        ),
                        value: e.id,
                      }))}
                      notFoundContent={
                        loading ? <Spin size="small" /> : "No entities found"
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {entityLoading && (
              <div className="text-center py-12">
                <Spin size="large" />
                <Text type="secondary" className="block mt-6 text-base">
                  Loading entity details...
                </Text>
              </div>
            )}

            {entityDetails && !entityLoading && (
              <>
                <hr className="border-slate-200 my-6" />

                {nestedEntities.length > 0 && (
                  <div>
                    <Title level={5} className="!mb-5">
                      Nested Entities
                    </Title>
                    <Alert
                      message="This entity contains nested entities. Select one to view its details."
                      type="info"
                      showIcon
                      className="mb-5"
                    />
                    <Select
                      placeholder="Select a nested entity"
                      className="w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selection-item]:!leading-[40px] [&_.ant-select-selection-placeholder]:!leading-[40px]"
                      size="large"
                      allowClear
                      value={selectedNestedEntityId}
                      onChange={(value) => {
                        const nestedEntity = nestedEntities.find(
                          (e) => e.id === value
                        );
                        handleNestedEntitySelect(nestedEntity);
                      }}
                      options={nestedEntities.map((entity) => ({
                        label: (
                          <Space size="middle" className="py-1">
                            <Text>{entity.name}</Text>
                            <Tag
                              color={getMethodColor(entity.method)}
                              className="text-sm px-3 py-0.5"
                            >
                              {entity.method}
                            </Tag>
                          </Space>
                        ),
                        value: entity.id,
                      }))}
                    />
                  </div>
                )}

                {selectedNestedEntity ? (
                  <div className="mt-8">
                    <Title level={4} className="!mb-8">
                      Nested Entity Details
                    </Title>
                    {renderEntityDetails(selectedNestedEntity)}
                  </div>
                ) : (
                  <div className="mt-8">
                    <Title level={4} className="!mb-8">
                      Entity Details
                    </Title>
                    {renderEntityDetails(entityDetails)}
                  </div>
                )}

                {nestedEntities.length > 0 && (
                  <div className="mt-8">
                    <Collapse
                      ghost
                      items={[
                        {
                          key: "1",
                          label: (
                            <Text strong className="text-base">
                              View All Nested Entities ({nestedEntities.length})
                            </Text>
                          ),
                          children: (
                            <div className="grid grid-cols-1 gap-5 mt-4">
                              {nestedEntities.map((nestedEntity) => (
                                <Card
                                  key={nestedEntity.id}
                                  size="small"
                                  hoverable
                                  onClick={() =>
                                    handleNestedEntitySelect(nestedEntity)
                                  }
                                  className={`cursor-pointer ${
                                    selectedNestedEntity?.id === nestedEntity.id
                                      ? "border-blue-400 bg-blue-50"
                                      : ""
                                  }`}
                                >
                                  <Space align="start" size="middle">
                                    <Tag
                                      color={getMethodColor(
                                        nestedEntity.method
                                      )}
                                      className="text-sm px-3 py-0.5"
                                    >
                                      {nestedEntity.method}
                                    </Tag>
                                    <div>
                                      <Text strong className="text-base">
                                        {nestedEntity.name}
                                      </Text>
                                      {nestedEntity.description && (
                                        <Paragraph
                                          type="secondary"
                                          className="!mb-0 !mt-2"
                                        >
                                          {nestedEntity.description}
                                        </Paragraph>
                                      )}
                                      <Space className="mt-3" size="middle">
                                        <Text type="secondary">
                                          {nestedEntity.response_fields?.length ?? 0}{" "}
                                          fields
                                        </Text>
                                        <Text type="secondary">•</Text>
                                        <Text type="secondary">
                                          {nestedEntity.filters?.length ?? 0} filters
                                        </Text>
                                      </Space>
                                    </div>
                                  </Space>
                                </Card>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                )}
              </>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default App;
