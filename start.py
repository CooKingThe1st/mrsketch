import os
import sys
import subprocess
import time

def run_services():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(script_dir, "backend")
    frontend_dir = os.path.join(script_dir, "frontend")

    print("=========================================================")
    print(" Scientific Sketch Link Development Stack Launcher")
    print("=========================================================")
    print(f" -> Backend Dir : {backend_dir}")
    print(f" -> Frontend Dir: {frontend_dir}")
    print("---------------------------------------------------------")

    # Start FastAPI Backend process
    print("Starting Python Matplotlib Backend on http://127.0.0.1:8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=backend_dir
    )

    time.sleep(1.5)

    # Start Vite React Frontend process
    print("Starting Vite React Frontend on http://localhost:5173...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir
    )

    print("\nScientific Sketch Link is running!")
    print("  -> Web Workspace : http://localhost:5173/")
    print("  -> Backend API   : http://127.0.0.1:8000/api/health")
    print("\nPress Ctrl+C to terminate both servers.\n")

    try:
        while True:
            # Check if any process terminated prematurely
            b_poll = backend_proc.poll()
            f_poll = frontend_proc.poll()

            if b_poll is not None:
                print(f"[ERROR] Backend process exited unexpectedly with code {b_poll}")
                break
            if f_poll is not None:
                print(f"[ERROR] Frontend process exited unexpectedly with code {f_poll}")
                break

            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping services...")
    finally:
        for proc in [backend_proc, frontend_proc]:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
        print("Shutdown complete.")

if __name__ == "__main__":
    run_services()
