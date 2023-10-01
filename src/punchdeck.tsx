import React from "react";
import { Box, Spacer, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
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

/** Title bar. */
function Title({ width }: { width: number }) {
  return (
    <Box
      borderStyle="round"
      borderColor="blue"
      paddingLeft={1}
      height={3}
      width={width}
    >
      <Text>P U N C H D E C K !</Text>
    </Box>
  );
}

function StatusBar({ paused }: { paused: boolean }) {
  return (
    <Box padding={1} width="100%" height={1}>
      <Text>Arrow keys, wasd, or hjkl to move, q to quit. Space to pause.</Text>
      <Text color="yellow">{paused ? " [Paused] " : ""}</Text>
    </Box>
  );
}

const useStreamData = (stream: Readable) => {
  const [data, setData] = useState('');
  useEffect(() => {
    const handleData = (chunk: string) => {
      setData((prevData) => prevData + chunk);
    };
	stream.on('data', handleData);
    return () => {
      stream.off('data', handleData);
    };
  }, [stream]);
  return data;
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
}: {
  columns: number;
  rows: number;
  title?: string;
  stream: Readable;
  selected: boolean;
}) {
  const streamData = useStreamData(stream);

  return (
    <Box
      borderStyle="round"
      borderColor={ selected ? "red" : "green" }
      flexDirection="column"
      width={columns}
      height={rows}
	  overflow="hidden"
    >
      <Text>{streamData}</Text>
    </Box>
  );
}

export interface PunchdeckProps {
  panes: PunchdeckPane[];
}

export function Punchdeck({ panes }: PunchdeckProps) {
  const [paused, setPaused] = useState(false);
  const [columns, rows] = useStdoutDimensions();

  useInput((input: any, key: any) => {
    if (input === " ") {
      setPaused(!paused);
    } else if (input === "q") {
      process.exit();
    }
  });

  const rowsPerPane = Math.floor((rows - 20) / panes.length);

  return (
    <Box flexDirection="column" height={rows}>
      <Title width={columns - 10} />
      {panes.map((pane, index) => (
        <Pane
          key={index}
          columns={columns - 10}
          rows={rowsPerPane}
          stream={pane.stream!}
		  selected={index === 0}
        />
      ))}
      <StatusBar paused={paused} />
    </Box>
  );
}
