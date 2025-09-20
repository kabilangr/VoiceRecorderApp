import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Sound from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';

interface Recording {
  name: string;
  path: string;
}

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecordingPath, setCurrentRecordingPath] = useState<string | null>(null);

  const audioPath = Platform.select({
    ios: `${RNFS.DocumentDirectoryPath}/recording-${Date.now()}.m4a`,
    android: `${RNFS.DocumentDirectoryPath}/recording-${Date.now()}.mp4`,
  });

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        if (
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
        } else {
          Alert.alert('Permissions Required', 'Please grant microphone and storage permissions to use this app.');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  useEffect(() => {
    requestPermissions();
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const dirPath = RNFS.DocumentDirectoryPath;
      const result = await RNFS.readDir(dirPath);
      const audioFiles = result.filter(item => item.name.endsWith('.m4a') || item.name.endsWith('.mp4'));
      const formattedRecordings = audioFiles.map(file => ({
        name: file.name,
        path: file.path,
      }));
      setRecordings(formattedRecordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const startRecording = async () => {
    if (!audioPath) return;
    try {
      await Sound.startRecorder(audioPath);
      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      console.error('startRecording failed', e);
    }
  };

  const pauseRecording = async () => {
    try {
      await Sound.pauseRecorder();
      setIsPaused(true);
    } catch (e) {
      console.error('pauseRecording failed', e);
    }
  };

  const resumeRecording = async () => {
    try {
      await Sound.resumeRecorder();
      setIsPaused(false);
    } catch (e) {
      console.error('resumeRecording failed', e);
    }
  };

  const stopRecording = async () => {
    try {
      await Sound.stopRecorder();
      setIsRecording(false);
      setIsPaused(false);
      await loadRecordings();
    } catch (e) {
      console.error('stopRecording failed', e);
    }
  };

  const startPlayback = async (path: string) => {
    try {
      await Sound.startPlayer(path);
      setIsPlaying(true);
      setCurrentRecordingPath(path);
      Sound.addPlayBackListener(info => {
        if ((info as any).isFinished) { // Type assertion fix
          setIsPlaying(false);
          setCurrentRecordingPath(null);
        }
      });
    } catch (e) {
      console.error('startPlayback failed', e);
    }
  };

  const pausePlayback = async () => {
    try {
      await Sound.pausePlayer();
      setIsPaused(true);
    } catch (e) {
      console.error('pausePlayback failed', e);
    }
  };

  const resumePlayback = async () => {
    try {
      await Sound.resumePlayer();
      setIsPaused(false);
    } catch (e) {
      console.error('resumePlayback failed', e);
    }
  };

  const stopPlayback = async () => {
    try {
      await Sound.stopPlayer();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentRecordingPath(null);
    } catch (e) {
      console.error('stopPlayback failed', e);
    }
  };

  const renderItem = ({ item }: { item: Recording }) => (
    <View style={styles.recordingItem}>
      <Text style={styles.recordingText}>{item.name}</Text>
      <View style={styles.playbackButtons}>
        <Button
          title={currentRecordingPath === item.path && isPlaying && !isPaused ? 'Pause' : 'Play'}
          onPress={() => {
            if (currentRecordingPath === item.path && isPlaying) {
              if (isPaused) {
                resumePlayback();
              } else {
                pausePlayback();
              }
            } else {
              startPlayback(item.path);
            }
          }}
        />
        {currentRecordingPath === item.path && isPlaying && (
          <Button
            title="Stop"
            onPress={stopPlayback}
            color="red"
          />
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <Text style={styles.title}>Voice Recorder</Text>
      <View style={styles.buttonContainer}>
        {!isRecording && (
          <Button title="Start Recording" onPress={startRecording} />
        )}
        {isRecording && !isPaused && (
          <>
            <Button title="Pause Recording" onPress={pauseRecording} />
            <Button title="Stop Recording" onPress={stopRecording} color="red" />
          </>
        )}
        {isRecording && isPaused && (
          <>
            <Button title="Resume Recording" onPress={resumeRecording} />
            <Button title="Stop Recording" onPress={stopRecording} color="red" />
          </>
        )}
      </View>

      <Text style={styles.listTitle}>Saved Recordings</Text>
      <FlatList
        data={recordings}
        renderItem={renderItem}
        keyExtractor={item => item.path}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  recordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  recordingText: {
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  playbackButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default App;