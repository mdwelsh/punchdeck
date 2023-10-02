import React from "react";
import { Box, Newline, Spacer, Text, useInput, useStdout } from "ink";
import { useEffect, useState, useRef, useReducer } from "react";
import { Readable } from "stream";

/** Get the size of the terminal window. */
export function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns,
    stdout.rows,
  ]);

  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows]);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  return dimensions;
}

function StatusBar({ paused }: { paused: boolean }) {
  return (
    <Box padding={0} width="100%" height={1}>
      <Text>
        <Text color="green">j/k</Text> to select,{" "}
        <Text color="green">up/down</Text> to scroll,{" "}
        <Text color="green">tab</Text> to focus, <Text color="green">c</Text> to
        collapse, <Text color="green">q</Text> to quit.
      </Text>
      <Text color="yellow">{paused ? " [Paused] " : ""}</Text>
    </Box>
  );
}

const useStreamData = (
  stream: Readable,
  paused: boolean,
  maxHistory?: number
) => {
  const dataRef = useRef<string[]>([]);
  const [returnData, setReturnData] = useState<string[]>([]);
  const currentLineRef = useRef<string>("");

  useEffect(() => {
    const handleData = (chunk: string) => {
      let currentLineData = currentLineRef.current + chunk;
      let newlineIndex;
      while ((newlineIndex = currentLineData.indexOf("\n")) !== -1) {
        const line = currentLineData.slice(0, newlineIndex);
        currentLineData = currentLineData.slice(newlineIndex + 1);
        if (maxHistory && dataRef.current.length + 1 > maxHistory) {
          dataRef.current.shift();
        }
        dataRef.current.push(line);
        if (!paused) {
          setReturnData([...dataRef.current]);
        }
      }
      currentLineRef.current = currentLineData;
    };
    stream.on("data", handleData);
    return () => {
      stream.off("data", handleData);
    };
  }, [stream, paused]);

  useEffect(() => {
    if (!paused) {
      setReturnData([...dataRef.current]);
    }
  }, [paused]);

  return returnData;
};

export interface PunchdeckPane {
  title?: string;
  stream: Readable;
}

function Pane({
  columns,
  rows,
  title,
  stream,
  selected,
  paused,
  collapsed,
  hidden,
  last,
  maxHistory,
}: {
  columns: number;
  rows: number;
  title?: string;
  stream: Readable;
  selected: boolean;
  paused: boolean;
  collapsed: boolean;
  hidden: boolean;
  last: number;
  maxHistory?: number;
}) {
  const streamData = useStreamData(stream, paused, maxHistory);

  useEffect(() => {}, [streamData]);

  const startIndex = Math.max(0, streamData.length - (rows - 2) + last);
  const endIndex = Math.max(0, startIndex + (rows - 2));

  return hidden ? null : (
    <Box
      borderStyle="round"
      borderColor={selected ? "green" : "dim"}
      flexDirection="column"
      width={columns}
      height={collapsed ? 3 : rows}
      overflowX="hidden"
      overflowY="visible"
    >
      <Box marginTop={-1}>
        <Spacer />
        <Text color={selected ? "green" : "dim"}>
          {selected ? "▶" : " "}
          {title}
        </Text>
      </Box>
      {/* {!collapsed && <Text>{streamData.slice(-rows).join("\n")}</Text>} */}
      {/* <Text>startIndex: {startIndex}</Text><Newline /> */}
      {/* <Text>endIndex: {endIndex}</Text><Newline /> */}
      {!collapsed && (
        <Text>{streamData.slice(startIndex, endIndex).join("\n")}</Text>
      )}
    </Box>
  );
}

export interface PunchdeckProps {
  panes: PunchdeckPane[];
  maxHistory?: number;
}

export function Punchdeck({ panes, maxHistory }: PunchdeckProps) {
  const [paused, setPaused] = useState(false);
  const [columns, rows] = useStdoutDimensions();
  const [selected, setSelected] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean[]>(panes.map(() => false));
  const [lastLine, setLastLine] = useState<number[]>(panes.map(() => 0));
  const [focused, setFocused] = useState(-1);

  useInput((input: any, key: any) => {
    if (input === " ") {
      if (paused) {
        setLastLine(panes.map(() => 0));
      }
      setPaused(!paused);
    } else if (input === "q") {
      process.exit();
    } else if (input === "k") {
      const newSelected = (selected + panes.length - 1) % panes.length;
      setSelected(newSelected);
      if (focused !== -1) {
        setFocused(newSelected);
      }
    } else if (input === "j") {
      const newSelected = (selected + 1) % panes.length;
      setSelected(newSelected);
      if (focused !== -1) {
        setFocused(newSelected);
      }
    } else if (key.upArrow) {
      let curLastLine = lastLine[selected] - 1;
      setLastLine(lastLine.map((c, i) => (i === selected ? curLastLine : c)));
    } else if (key.downArrow) {
      let curLastLine = Math.min(0, lastLine[selected] + 1);
      setLastLine(lastLine.map((c, i) => (i === selected ? curLastLine : c)));
    } else if (input === "c") {
      setCollapsed(collapsed.map((c, i) => (i === selected ? !c : c)));
    } else if (key.tab && focused === -1) {
      setFocused(selected);
    } else if (key.tab && focused !== -1) {
      setFocused(-1);
    }
  });

  const numCollapsed = collapsed.reduce((acc, c) => acc + (c ? 1 : 0), 0);
  const rowsPerPane =
    focused !== -1
      ? rows - 4
      : Math.floor((rows - numCollapsed * 4) / (panes.length - numCollapsed));

  return (
    <Box flexDirection="column" height={rows}>
      {panes.map((pane, index) => (
        <Pane
          key={index}
          columns={columns - 5}
          rows={rowsPerPane}
          title={pane.title}
          stream={pane.stream!}
          selected={index === selected}
          maxHistory={maxHistory}
          last={lastLine[index]}
          paused={paused}
          hidden={focused !== -1 && focused !== index}
          collapsed={focused === -1 && collapsed[index]}
        />
      ))}
      <StatusBar paused={paused} />
    </Box>
  );
}
